/**
 * roomManager.js — Room lifecycle management.
 */

const { v4: uuidv4 } = require("uuid");
const { createGameState, createPlayer } = require("../game/gameState");
const { isValidProfileId, getProfileById } = require("../data/profiles");

const rooms = new Map();
const MAX_PLAYERS = 12;

function createRoom(socketId, username, profileId, settings = {}) {
    if (!isValidProfileId(profileId)) return { success: false, error: "Invalid profile." };
    const err = validateUsername(username);
    if (err) return { success: false, error: err };

    const roomId = generateRoomId();
    const gameState = createGameState(roomId, settings);
    const host = createPlayer(socketId, username, profileId, true);
    host.profileName = getProfileById(profileId)?.name || null;
    gameState.players.push(host);
    rooms.set(roomId, gameState);

    return { success: true, roomId, state: sanitizeStateForLobby(gameState) };
}

function joinRoom(socketId, roomId, username, profileId, password = null) {
    const gs = rooms.get(roomId);
    if (!gs) return { success: false, error: "Room not found." };
    if (gs.phase !== "LOBBY") return { success: false, error: "Game already started." };
    if (gs.players.length >= MAX_PLAYERS) return { success: false, error: "Room is full." };
    if (gs.settings.password && password !== gs.settings.password)
        return { success: false, error: "Wrong password." };
    if (gs.players.find(p => p.id === socketId))
        return { success: false, error: "Already in room." };
    if (gs.players.find(p => p.profileId === profileId))
        return { success: false, error: "Profile already taken." };
    if (!isValidProfileId(profileId)) return { success: false, error: "Invalid profile." };

    const err = validateUsername(username);
    if (err) return { success: false, error: err };
    if (gs.players.find(p => p.username.toLowerCase() === username.toLowerCase()))
        return { success: false, error: "Username taken." };

    const player = createPlayer(socketId, username, profileId, false);
    player.profileName = getProfileById(profileId)?.name || null;
    gs.players.push(player);
    return { success: true, state: sanitizeStateForLobby(gs) };
}

function removePlayer(socketId) {
    const roomId = findRoomBySocket(socketId);
    if (!roomId) return { roomId: null, destroyed: false, newHostId: null, state: null };

    const gs = rooms.get(roomId);
    const idx = gs.players.findIndex(p => p.id === socketId);
    if (idx === -1) return { roomId, destroyed: false, newHostId: null, state: null };

    const leaving = gs.players[idx];
    gs.players.splice(idx, 1);

    if (gs.players.length === 0) {
        rooms.delete(roomId);
        return { roomId, destroyed: true, newHostId: null, state: null };
    }

    let newHostId = null;
    if (leaving.isHost) {
        gs.players[0].isHost = true;
        newHostId = gs.players[0].id;
    }

    return { roomId, destroyed: false, newHostId, state: sanitizeStateForLobby(gs) };
}

function updateSettings(socketId, roomId, settings) {
    const gs = rooms.get(roomId);
    if (!gs) return { success: false, error: "Room not found." };
    if (gs.phase !== "LOBBY") return { success: false, error: "Game already started." };

    const host = gs.players.find(p => p.id === socketId);
    if (!host || !host.isHost) return { success: false, error: "Only host can change settings." };

    const allowed = ["password", "hasEngineer", "hasDoctor", "hasGuardian", "gnosiaCount"];
    for (const key of allowed) {
        if (settings[key] !== undefined) gs.settings[key] = settings[key];
    }

    return { success: true, state: sanitizeStateForLobby(gs) };
}

function getRoom(roomId) { return rooms.get(roomId) || null; }
function findRoomBySocket(socketId) {
    for (const [roomId, gs] of rooms.entries()) {
        if (gs.players.find(p => p.id === socketId)) return roomId;
    }
    return null;
}

function generateRoomId() {
    return "NEB-" + uuidv4().replace(/-/g, "").slice(0, 4).toUpperCase();
}

function validateUsername(u) {
    if (!u || typeof u !== "string") return "Username required.";
    const t = u.trim();
    if (t.length < 2) return "Username too short (min 2).";
    if (t.length > 20) return "Username too long (max 20).";
    if (!/^[a-zA-Z0-9_ ]+$/.test(t)) return "Letters, numbers, spaces, underscores only.";
    return null;
}

function sanitizeStateForLobby(gs) {
    return {
        roomId: gs.roomId,
        phase: gs.phase,
        round: gs.round,
        settings: {
            hasPassword: !!gs.settings.password,
            hasEngineer: gs.settings.hasEngineer,
            hasDoctor: gs.settings.hasDoctor,
            hasGuardian: gs.settings.hasGuardian,
            gnosiaCount: gs.settings.gnosiaCount,
        },
        players: gs.players.map(p => ({
            id: p.id, username: p.username, profileId: p.profileId, profileName: p.profileName || null,
            isHost: p.isHost, alive: p.alive, inColdSleep: p.inColdSleep,
        })),
        winner: gs.winner,
        timers: gs.timers,
    };
}

module.exports = {
    createRoom, joinRoom, removePlayer, updateSettings,
    getRoom, findRoomBySocket, sanitizeStateForLobby,
};