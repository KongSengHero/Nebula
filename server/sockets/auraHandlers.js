const { getRoom, updateRoomActivity } = require("../rooms/roomManager");

const AURA_ROLL_OPTIONS = [
    "aura-rage-mode",
    "aura-golden-saiyan",
    "aura-glacier",
    "aura-sunset",
    "aura-glitch",
    "aura-sparkle-white",
    "aura-sparkle-yellow",
    "aura-sparkle-pink",
    "aura-judgement",
    "aura-red-saiyan",
    "aura-halo",
    "aura-void",
    "aura-sparkle-rainbow",
    "aura-sparkle-red",
];

module.exports = function registerAuraHandlers(io, socket, { bindAckHandler, reply }) {
    
    bindAckHandler("player:rollAura", ({ roomId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return reply(cb, { success: false, error: "Room not found." });
        updateRoomActivity(roomId);
        const player = gs.players.find(p => p.id === socket.id);
        if (!player) return reply(cb, { success: false, error: "Player not found." });
        if ((player.rollsRemaining || 0) <= 0) return reply(cb, { success: false, error: "No rolls remaining." });

        const picked = AURA_ROLL_OPTIONS[Math.floor(Math.random() * AURA_ROLL_OPTIONS.length)];
        player.aura = picked;
        player.rollsRemaining -= 1;

        io.to(roomId).emit("player:auraUpdated", { playerId: socket.id, aura: picked, rollsRemaining: player.rollsRemaining });
        reply(cb, { success: true, aura: picked, rollsRemaining: player.rollsRemaining });
    });

    bindAckHandler("player:emote", ({ roomId, emote }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return reply(cb, { success: false, error: "Room not found." });
        updateRoomActivity(roomId);
        const player = gs.players.find(p => p.id === socket.id);
        if (!player) return reply(cb, { success: false, error: "Player not found." });
        
        const src   = String(emote?.src   || "").replace(/[^a-z0-9_.\-/]/gi, "").slice(0, 80);
        const label = String(emote?.label || "").replace(/[^a-z0-9 ]/gi, "").slice(0, 16).toUpperCase();
        const id    = String(emote?.id    || "").replace(/[^a-z0-9_]/gi, "").slice(0, 30);
        if (!src) return reply(cb, { success: false, error: "Invalid emote." });
        io.to(roomId).emit("player:emote", { playerId: socket.id, emote: { src, label, id } });
        reply(cb, { success: true });
    });

    bindAckHandler("player:selectAura", ({ roomId, aura }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return reply(cb, { success: false, error: "Room not found." });
        updateRoomActivity(roomId);
        const player = gs.players.find(p => p.id === socket.id);
        if (!player) return reply(cb, { success: false, error: "Player not found." });
        
        if (!gs.players.find(p => p.id === socket.id && p.isHost)) {
            return reply(cb, { success: false, error: "Only host can select aura." });
        }

        player.aura = aura;
        io.to(roomId).emit("player:auraUpdated", { playerId: socket.id, aura: aura, rollsRemaining: player.rollsRemaining });
        reply(cb, { success: true });
    });
};
