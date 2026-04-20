const { isGnosiaRole, getGnosiaIds, buildRolePayload, countGnosiaPlayers } = require("./roles");
const stateMachine = require("./stateMachine");

const ILLUSIONIST_SELECTION_WINDOW_MS = 20000;
const pendingIllusionistTimers = new Map();

function clearPendingIllusionistTimer(roomId) {
    const handle = pendingIllusionistTimers.get(roomId);
    if (!handle) return;
    clearTimeout(handle);
    pendingIllusionistTimers.delete(roomId);
}

function buildIllusionistCandidates(gameState, illusionistId) {
    return gameState.players
        .filter((player) => player.id !== illusionistId && !isGnosiaRole(player.role))
        .map((player) => ({
            id: player.id,
            username: player.username,
            profileId: player.profileId,
            profileName: player.profileName || null,
        }));
}

function finalizeLobbyGameStart(io, gameState) {
    clearPendingIllusionistTimer(gameState.roomId);
    const meta = gameState.meta || (gameState.meta = {});
    meta.startPending = false;
    meta.pendingIllusionistChoice = false;
    meta.illusionistId = gameState.players.find((player) => player.role === "illusionist")?.id || null;

    const gnosiaChannel = `${gameState.roomId}:gnosia`;
    for (const gid of getGnosiaIds(gameState)) {
        const playerSocket = io.sockets.sockets.get(gid);
        if (playerSocket) playerSocket.join(gnosiaChannel);
    }

    io.to(gameState.roomId).emit("pregame:illusionistResolved");

    for (const player of gameState.players) {
        io.to(player.id).emit("game:roleAssigned", buildRolePayload(player, gameState));
    }

    io.to(gameState.roomId).emit("game:starting", {
        playerCount: gameState.players.length,
        gnosiaCount: countGnosiaPlayers(gameState),
    });

    stateMachine.stopRoomMusic(gameState, stateMachine.MUSIC_TRANSITION_MS);
    stateMachine.scheduleGameStart(gameState, 5000);
}

function resolveIllusionistInfection(io, gameState, requestedTargetId = null) {
    if (!gameState) return { success: false, error: "Room not found." };

    const meta = gameState.meta || (gameState.meta = {});
    if (!meta.pendingIllusionistChoice) {
        return { success: false, error: "Illusionist choice is no longer pending." };
    }

    const illusionistId = meta.illusionistId;
    const candidates = buildIllusionistCandidates(gameState, illusionistId);
    if (candidates.length === 0) {
        finalizeLobbyGameStart(io, gameState);
        return { success: true, infectedId: null, infectedUsername: null };
    }

    let target =
        requestedTargetId && requestedTargetId !== "random"
            ? gameState.players.find(
                (player) =>
                    player.id === requestedTargetId &&
                    player.id !== illusionistId &&
                    !isGnosiaRole(player.role)
            )
            : null;

    if (!target) {
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        target = gameState.players.find((player) => player.id === picked.id) || null;
    }

    if (!target) {
        finalizeLobbyGameStart(io, gameState);
        return { success: true, infectedId: null, infectedUsername: null };
    }

    target.role = "gnosia";
    console.log(`[Roles] ${gameState.roomId}: Illusionist infected ${target.username}`);

    finalizeLobbyGameStart(io, gameState);
    return { success: true, infectedId: target.id, infectedUsername: target.username };
}

function startIllusionistPregame(io, gameState) {
    const illusionist = gameState.players.find((player) => player.role === "illusionist");
    if (!illusionist) {
        finalizeLobbyGameStart(io, gameState);
        return;
    }

    const meta = gameState.meta || (gameState.meta = {});
    meta.pendingIllusionistChoice = true;
    meta.illusionistId = illusionist.id;

    const candidates = buildIllusionistCandidates(gameState, illusionist.id);
    if (candidates.length === 0) {
        finalizeLobbyGameStart(io, gameState);
        return;
    }

    io.to(gameState.roomId).emit("pregame:illusionistManifesting", {
        roomId: gameState.roomId,
        durationMs: ILLUSIONIST_SELECTION_WINDOW_MS,
    });

    io.to(illusionist.id).emit("pregame:illusionistPrompt", {
        roomId: gameState.roomId,
        durationMs: ILLUSIONIST_SELECTION_WINDOW_MS,
        candidates,
    });

    clearPendingIllusionistTimer(gameState.roomId);
    const handle = setTimeout(() => {
        pendingIllusionistTimers.delete(gameState.roomId);
        if (gameState.phase !== "LOBBY") return;
        resolveIllusionistInfection(io, gameState, null);
    }, ILLUSIONIST_SELECTION_WINDOW_MS);
    pendingIllusionistTimers.set(gameState.roomId, handle);
}

module.exports = {
    startIllusionistPregame,
    resolveIllusionistInfection,
    clearPendingIllusionistTimer,
    buildIllusionistCandidates,
    finalizeLobbyGameStart,
    ILLUSIONIST_SELECTION_WINDOW_MS,
};
