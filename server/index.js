/**
 * index.js — Project Nebula Server (Final)
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const { createRoom, joinRoom, removePlayer, updateSettings, getRoom, sanitizeStateForLobby } = require("./rooms/roomManager");
const { getAllProfiles } = require("./data/profiles");
const { assignRoles, getGnosiaIds, buildRolePayload } = require("./game/roles");
const stateMachine = require("./game/stateMachine");
const nightResolver = require("./game/nightResolver");

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true,
    },
});

stateMachine.init(io);
nightResolver.init(io);

app.use(cors());
app.use(express.json());

// ── Serve profile images from /server/data/profiles ──
const profilesPath = path.join(__dirname, "data", "profiles");
app.use("/profiles", express.static(profilesPath));
console.log(`[Static] Serving profile images from: ${profilesPath}`);

// ── REST ──────────────────────────────────────────────────────────────
app.get("/api/profiles", (_req, res) => res.json({ profiles: getAllProfiles() }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// ── Message builder ───────────────────────────────────────────────────
function buildMessage(sender, text, channel) {
    return {
        id: crypto.randomUUID(),
        channel,
        text,
        senderId: sender.id,
        senderName: sender.username,
        profileId: sender.profileId,
        timestamp: Date.now(),
    };
}

// ── Socket.io ─────────────────────────────────────────────────────────
io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── LOBBY ─────────────────────────────────────────────────────────
    socket.on("room:create", ({ username, profileId, settings }, cb) => {
        const result = createRoom(socket.id, username, profileId, settings);
        if (!result.success) return cb({ success: false, error: result.error });
        socket.join(result.roomId);
        socket.join(`${result.roomId}:lobby`);
        cb({ success: true, roomId: result.roomId, state: result.state });
    });

    socket.on("room:join", ({ roomId, username, profileId, password }, cb) => {
        const result = joinRoom(socket.id, roomId, username, profileId, password);
        if (!result.success) return cb({ success: false, error: result.error });
        socket.join(roomId);
        socket.join(`${roomId}:lobby`);
        cb({ success: true, state: result.state });
        io.to(`${roomId}:lobby`).emit("lobby:updated", { state: result.state });
    });

    socket.on("room:updateSettings", ({ roomId, settings }, cb) => {
        const result = updateSettings(socket.id, roomId, settings);
        if (!result.success) return cb({ success: false, error: result.error });
        cb({ success: true, state: result.state });
        io.to(`${roomId}:lobby`).emit("lobby:updated", { state: result.state });
    });

    socket.on("room:getState", ({ roomId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return cb({ success: false, error: "Room not found." });
        cb({ success: true, state: sanitizeStateForLobby(gs) });
    });

    // ── GAME START ────────────────────────────────────────────────────
    socket.on("game:start", ({ roomId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return cb({ success: false, error: "Room not found." });
        if (gs.phase !== "LOBBY") return cb({ success: false, error: "Game already started." });

        const host = gs.players.find(p => p.id === socket.id);
        if (!host || !host.isHost) return cb({ success: false, error: "Only host can start." });
        if (gs.players.length < 2) return cb({ success: false, error: "Need at least 2 players." });

        try { assignRoles(gs); }
        catch (err) { return cb({ success: false, error: err.message }); }

        const gnosiaChannel = `${roomId}:gnosia`;
        for (const gid of getGnosiaIds(gs)) {
            const s = io.sockets.sockets.get(gid);
            if (s) s.join(gnosiaChannel);
        }

        for (const player of gs.players) {
            io.to(player.id).emit("game:roleAssigned", buildRolePayload(player, gs));
        }

        cb({ success: true });
        const gnosiaCount = gs.players.filter(p => p.role === "gnosia").length;
        io.to(roomId).emit("game:starting", { playerCount: gs.players.length, gnosiaCount });

        setTimeout(() => stateMachine.startGame(gs), 5000);
    });

    // ── CHAT ──────────────────────────────────────────────────────────
    socket.on("chat:message", ({ roomId, channel, text }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return cb({ success: false, error: "Room not found." });

        const sender = gs.players.find(p => p.id === socket.id);
        if (!sender) return cb({ success: false, error: "Player not found." });
        if (!sender.alive) return cb({ success: false, error: "Dead players cannot chat." });

        const trimmed = (text || "").trim();
        if (!trimmed) return cb({ success: false, error: "Empty message." });
        if (trimmed.length > 300) return cb({ success: false, error: "Max 300 characters." });

        const { phase } = gs;

        if (channel === "public") {
            if (phase === "NIGHT") return cb({ success: false, error: "Public chat closed at night." });
            const msg = buildMessage(sender, trimmed, "public");
            io.to(roomId).emit("chat:message", msg);
            return cb({ success: true });
        }

        if (channel === "gnosia") {
            if (sender.role !== "gnosia") return cb({ success: false, error: "Channel not available." });
            if (phase !== "DAY_DISCUSSION" && phase !== "NIGHT")
                return cb({ success: false, error: "Gnosia channel not active." });
            const msg = buildMessage(sender, trimmed, "gnosia");
            io.to(`${roomId}:gnosia`).emit("chat:message", msg);
            return cb({ success: true });
        }

        cb({ success: false, error: "Invalid channel." });
    });

    // ── VOTING ────────────────────────────────────────────────────────
    socket.on("vote:submit", ({ roomId, targetId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return cb({ success: false, error: "Room not found." });
        if (gs.phase !== "VOTING") return cb({ success: false, error: "Not voting phase." });

        const voter = gs.players.find(p => p.id === socket.id && p.alive);
        if (!voter) return cb({ success: false, error: "Cannot vote." });
        const target = gs.players.find(p => p.id === targetId && p.alive);
        if (!target) return cb({ success: false, error: "Invalid target." });
        if (targetId === socket.id) return cb({ success: false, error: "Cannot vote yourself." });

        gs.votes[socket.id] = targetId;
        voter.voteTarget = targetId;
        cb({ success: true });

        const votesCast = Object.keys(gs.votes).length;
        const totalAlive = gs.players.filter(p => p.alive).length;
        io.to(roomId).emit("vote:progress", { votesCast, totalAlive });
    });

    // ── NIGHT ACTIONS ─────────────────────────────────────────────────
    socket.on("night:action", ({ roomId, actionType, targetId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return cb({ success: false, error: "Room not found." });
        if (gs.phase !== "NIGHT") return cb({ success: false, error: "Not night phase." });

        const actor = gs.players.find(p => p.id === socket.id && p.alive);
        if (!actor) return cb({ success: false, error: "Cannot act." });

        const { nightActions, players } = gs;

        switch (actionType) {
            case "gnosia_vote": {
                if (actor.role !== "gnosia") return cb({ success: false, error: "Not authorized." });
                const target = players.find(p => p.id === targetId && p.alive && p.id !== socket.id);
                if (!target) return cb({ success: false, error: "Invalid target." });
                nightActions.gnosiaVotes[socket.id] = targetId;
                const gCount = players.filter(p => p.alive && p.role === "gnosia").length;
                const vIn = Object.keys(nightActions.gnosiaVotes).length;
                io.to(`${roomId}:gnosia`).emit("night:gnosiaVoteProgress", { votesIn: vIn, totalGnosia: gCount });
                cb({ success: true });
                break;
            }
            case "engineer": {
                if (actor.role !== "engineer") return cb({ success: false, error: "Not authorized." });
                const target = players.find(p => p.id === targetId && p.alive && p.id !== socket.id);
                if (!target) return cb({ success: false, error: "Invalid target." });
                nightActions.engineerTarget = targetId;
                cb({ success: true });

                // Immediately deliver private scan result (no need to wait for night end)
                const isGnosia = target.role === "gnosia";
                io.to(actor.id).emit("night:scanResult", {
                    targetId,
                    isGnosia,
                    targetUsername: target.username,
                });

                // If target is Gnosia, immediately alert them they were scanned
                if (isGnosia) {
                    io.to(targetId).emit("night:scannedAlert", {
                        message: "You have been scanned by the Engineer.",
                    });
                }
                break;
            }
            case "doctor": {
                if (actor.role !== "doctor") return cb({ success: false, error: "Not authorized." });
                const target = players.find(p => p.id === targetId && p.inColdSleep);
                if (!target) return cb({ success: false, error: "Target not in Cold Sleep." });
                nightActions.doctorTarget = targetId;
                cb({ success: true });

                // Immediately deliver private inspection result
                io.to(actor.id).emit("night:inspectResult", {
                    targetId,
                    role: target.role,
                    targetUsername: target.username,
                    error: null,
                });
                break;
            }
            case "guardian": {
                if (actor.role !== "guardian") return cb({ success: false, error: "Not authorized." });
                if (targetId === socket.id) return cb({ success: false, error: "Cannot self-protect." });
                const target = players.find(p => p.id === targetId && p.alive);
                if (!target) return cb({ success: false, error: "Invalid target." });
                nightActions.guardianTarget = targetId;
                cb({ success: true });
                break;
            }
            default:
                return cb({ success: false, error: "Unknown action." });
        }

        if (nightResolver.allNightActionsSubmitted(gs)) {
            setTimeout(() => nightResolver.resolveNight(gs), 500);
        }
    });

    // ── HOST DEBUG ────────────────────────────────────────────────────
    socket.on("phase:forceAdvance", ({ roomId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return cb({ success: false, error: "Room not found." });
        cb(stateMachine.forceAdvance(gs, socket.id));
    });

    // ── DISCONNECT ────────────────────────────────────────────────────
    socket.on("disconnect", () => {
        const result = removePlayer(socket.id);
        if (!result.roomId || result.destroyed) {
            if (result.roomId) stateMachine.cleanupRoom(result.roomId);
            return;
        }
        io.to(`${result.roomId}:lobby`).emit("lobby:updated", { state: result.state });
        if (result.newHostId) {
            io.to(`${result.roomId}:lobby`).emit("lobby:hostChanged", { newHostId: result.newHostId });
        }
        stateMachine.broadcastToRoom(result.roomId, "player:disconnected", { socketId: socket.id });
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`\n🚀 Project Nebula — http://localhost:${PORT}`);
    console.log(`   Profile images: http://localhost:${PORT}/profiles/setsu.jpg`);
});

module.exports = { io };