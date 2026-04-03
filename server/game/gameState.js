/**
 * gameState.js — Authoritative game state factory.
 */

function createPlayer(socketId, username, profileId, isHost = false, sessionToken = null) {
    return {
        id: socketId,
        username,
        profileId,
        sessionToken: sessionToken || null,
        disconnected: false,
        isHost,
        role: null,
        alive: true,
        inColdSleep: false,
        voteTarget: null,
        protected: false,
        scanned: false,
        dismissed: false,
        aura: null,           // Equipped aura CSS class; persists until rerolled
        rollsRemaining: 0,   // Start with 0, get 2 when die, 1 per subsequent round
    };
}

function createGameState(roomId, settings = {}) {
    return {
        roomId,
        phase: "LOBBY",
        round: 0,
        meta: {
            phaseSeq: 0,
            nightResolvedSeq: null,
        },
        players: [],
        settings: {
            password: settings.password || null,
            hasEngineer: settings.hasEngineer || false,
            hasDoctor: settings.hasDoctor || false,
            hasGuardian: settings.hasGuardian || false,
            hasLawyer: settings.hasLawyer || false,
            hasTraitor: settings.hasTraitor || false,
            gnosiaCount: settings.gnosiaCount || null, // null = auto (floor(n/3))
        },
        nightActions: {
            gnosiaVotes: {},
            gnosiaTarget: null,
            engineerTarget: null,
            doctorTarget: null,
            guardianTarget: null,
        },
        votes: {},
        skipVotes: {},
        nominations: {},
        timers: {
            phase: null,
            endsAt: null,
            durationMs: null,
        },
        morningReport: {
            killed: null,
            savedBy: null,
            coldSleep: null,
            killedUsername: null,
            coldSleepUsername: null,
        },
        winner: null,
    };
}

function resetNightFlags(gameState) {
    console.log(`[RESET] Resetting night flags for round ${gameState.round}`);
    for (const player of gameState.players) {
        player.protected = false;
        player.scanned = false;
        player.voteTarget = null;
        
        // Ensure rollsRemaining exists
        if (typeof player.rollsRemaining !== 'number') {
            player.rollsRemaining = 0;
        }
        
        // Give 1 roll per round to dead players (except first round after death)
        if (!player.alive) {
            const previousRolls = player.rollsRemaining;
            player.rollsRemaining = (player.rollsRemaining || 0) + 1;
            console.log(`[RESET] Dead player ${player.username}: ${previousRolls} -> ${player.rollsRemaining} rolls`);
        } else {
            // Alive players get no rolls
            player.rollsRemaining = 0;
        }
    }
    gameState.nightActions = {
        gnosiaVotes: {},
        gnosiaTarget: null,
        engineerTarget: null,
        doctorTarget: null,
        guardianTarget: null,
    };
    gameState.votes = {};
    gameState.skipVotes = {};
    gameState.nominations = {};
    gameState.morningReport = {
        killed: null, savedBy: null, coldSleep: null,
        killedUsername: null, coldSleepUsername: null,
    };
}

module.exports = { createGameState, createPlayer, resetNightFlags };
