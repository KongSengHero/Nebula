const {
    createRoom, joinRoom, removePlayer, updateSettings, getRoom, sanitizeStateForLobby,
    resumeSession, resetRoom, updateRoomActivity
} = require("../rooms/roomManager");
const {
    assignRoles,
    buildRolePayload,
    countGnosiaPlayers,
    getGnosiaIds,
} = require("../game/roles");
const stateMachine = require("../game/stateMachine");

module.exports = function registerLobbyHandlers(io, socket, { bindAckHandler, reply, clearPendingIllusionistTimer, startIllusionistPregame, resolveIllusionistInfection }) {
    
    bindAckHandler("room:create", ({ username, profileId, settings, sessionToken }, cb) => {
        const result = createRoom(socket.id, username, profileId, settings, sessionToken || null);
        if (!result.success) return reply(cb, { success: false, error: result.error });
        socket.join(result.roomId);
        socket.join(`${result.roomId}:lobby`);
        const gs = getRoom(result.roomId);
        reply(cb, { success: true, roomId: result.roomId, state: result.state });
        if (gs) stateMachine.broadcastMusicState(gs);
    });

    bindAckHandler("room:join", ({ roomId, username, profileId, password, sessionToken }, cb) => {
        const result = joinRoom(socket.id, roomId, username, profileId, password, sessionToken || null);
        if (!result.success) return reply(cb, { success: false, error: result.error });
        socket.join(roomId);
        socket.join(`${roomId}:lobby`);
        reply(cb, { success: true, state: result.state });
        io.to(`${roomId}:lobby`).emit("lobby:updated", { state: result.state });
        const gs = getRoom(roomId);
        if (gs) stateMachine.broadcastMusicState(gs);
    });

    bindAckHandler("room:updateSettings", ({ roomId, settings }, cb) => {
        const result = updateSettings(socket.id, roomId, settings);
        if (!result.success) return reply(cb, { success: false, error: result.error });
        updateRoomActivity(roomId);
        const gs = getRoom(roomId);
        if (gs) {
            if (gs.phase === "LOBBY") {
                if (gs.settings.lobbyMusicEnabled === false) {
                    stateMachine.stopRoomMusic(gs, stateMachine.MUSIC_TRANSITION_MS);
                } else {
                    stateMachine.syncLobbyMusic(gs);
                }
            } else if (gs.phase === "END") {
                if (gs.settings.endGameMusicEnabled === false) {
                    stateMachine.stopRoomMusic(gs, stateMachine.MUSIC_TRANSITION_MS);
                } else if (!gs.musicPlayback?.trackKey && gs.winner) {
                    stateMachine.playEndGameMusic(gs, gs.winner, stateMachine.MUSIC_TRANSITION_MS);
                }
            } else {
                stateMachine.broadcastMusicState(gs);
            }
        }
        const nextState = gs ? sanitizeStateForLobby(gs) : result.state;
        reply(cb, { success: true, state: nextState });
        io.to(`${roomId}:lobby`).emit("lobby:updated", { state: nextState });
    });

    bindAckHandler("music:play", ({ roomId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return reply(cb, { success: false, error: "Room not found." });
        updateRoomActivity(roomId);
        const host = gs.players.find(p => p.id === socket.id);
        if (!host || !host.isHost) return reply(cb, { success: false, error: "Only host can control music." });

        if (gs.phase === "LOBBY") {
            if (gs.settings.lobbyMusicEnabled === false) {
                return reply(cb, { success: false, error: "Enable lobby music first." });
            }
            stateMachine.syncLobbyMusic(gs, { forceRestart: true });
            return reply(cb, { success: true });
        }

        if (gs.phase === "END") {
            if (gs.settings.endGameMusicEnabled === false) {
                return reply(cb, { success: false, error: "Enable end game music first." });
            }
            if (!gs.winner) {
                return reply(cb, { success: false, error: "No winner yet." });
            }
            stateMachine.playEndGameMusic(gs, gs.winner, stateMachine.MUSIC_TRANSITION_MS);
            return reply(cb, { success: true });
        }

        reply(cb, { success: false, error: "Music can only be started from lobby or end game." });
    });

    bindAckHandler("room:getState", ({ roomId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return reply(cb, { success: false, error: "Room not found." });
        updateRoomActivity(roomId);
        reply(cb, { success: true, state: sanitizeStateForLobby(gs) });
    });

    bindAckHandler("room:leave", ({ roomId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return reply(cb, { success: false, error: "Room not found." });
        updateRoomActivity(roomId);

        const player = gs.players.find(p => p.id === socket.id);
        if (!player) return reply(cb, { success: false, error: "Player not found in room." });

        if (gs.phase !== "LOBBY") {
            return reply(cb, { success: false, error: "Cannot leave after game has started." });
        }

        const result = removePlayer(socket.id);
        reply(cb, { success: true });

        if (result.roomId) {
            io.to(`${result.roomId}:lobby`).emit("lobby:updated", { state: result.state });
            if (result.newHostId) {
                io.to(`${result.roomId}:lobby`).emit("lobby:hostChanged", { newHostId: result.newHostId });
            }
        }

        if (result.destroyed) {
            clearPendingIllusionistTimer(roomId);
            require("../game/nightResolver").cleanupRoom(roomId);
            stateMachine.cleanupRoom(roomId);
            console.log(`[Room] Room ${roomId} destroyed (no players left)`);
        }
    });

    bindAckHandler("session:resume", ({ roomId, username, profileId, sessionToken, password }, cb) => {
        const rid = typeof roomId === "string" ? roomId.trim().toUpperCase() : roomId;
        const result = resumeSession(socket.id, {
            roomId: rid,
            username,
            profileId,
            sessionToken,
            password: password ?? null,
        });
        if (!result.success) return reply(cb, result);

        const gs = result.gameState;
        const player = result.player;
        const oldId = result.oldSocketId;

        updateRoomActivity(rid);
        socket.join(rid);
        socket.join(`${rid}:lobby`);
        if (require("../game/roles").isGnosiaRole(player.role)) {
            socket.join(`${rid}:gnosia`);
        }

        io.to(`${rid}:lobby`).emit("lobby:updated", { state: sanitizeStateForLobby(gs) });
        io.to(socket.id).emit("music:state", stateMachine.buildMusicPayload(gs));

        io.to(rid).emit("player:reconnected", {
            previousId: oldId,
            newId: socket.id,
            username: player.username,
        });

        const inGame = gs.phase !== "LOBBY" && gs.phase !== "END";
        const rolePayload = player.role ? buildRolePayload(player, gs) : null;
        const phasePayload = inGame ? stateMachine.buildPhasePayload(gs) : null;
        const pregameState = gs.meta?.pendingIllusionistChoice
            ? {
                mode: gs.meta?.illusionistId === socket.id ? "prompt" : "manifesting",
                roomId: rid,
                durationMs: require("../game/illusionistManager").ILLUSIONIST_SELECTION_WINDOW_MS,
                candidates: gs.meta?.illusionistId === socket.id
                    ? require("../game/illusionistManager").buildIllusionistCandidates(gs, socket.id)
                    : [],
            }
            : null;

        reply(cb, {
            success: true,
            lobbyState: sanitizeStateForLobby(gs),
            phase: gs.phase,
            inGame,
            phasePayload,
            rolePayload,
            pregameState,
            myId: socket.id,
        });
    });

    bindAckHandler("room:playAgain", ({ roomId }, cb) => {
        const result = resetRoom(socket.id, roomId);
        if (!result.success) return reply(cb, { success: false, error: result.error });
        updateRoomActivity(roomId);
        clearPendingIllusionistTimer(roomId);
        
        try {
            const gnosiaChannel = `${roomId}:gnosia`;
            const roomSockets = io.sockets.adapter.rooms.get(roomId);
            if (roomSockets) {
                for (const sid of roomSockets) {
                    const s = io.sockets.sockets.get(sid);
                    if (s) s.leave(gnosiaChannel);
                }
            }
        } catch (e) {
            console.error("Error clearing gnosia channel on playAgain", e);
        }

        const gs = getRoom(roomId);
        if (gs) io.to(roomId).emit("room:backToLobby", sanitizeStateForLobby(gs));
        reply(cb, { success: true });
    });

    bindAckHandler("game:start", ({ roomId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return reply(cb, { success: false, error: "Room not found." });
        updateRoomActivity(roomId);
        if (gs.phase !== "LOBBY") return reply(cb, { success: false, error: "Game already started." });
        if (stateMachine.isGameStartScheduled(roomId) || gs.meta?.startPending) {
            return reply(cb, { success: false, error: "Game is already starting." });
        }

        const host = gs.players.find(p => p.id === socket.id);
        if (!host || !host.isHost) return reply(cb, { success: false, error: "Only host can start." });
        if (gs.players.length < 2) return reply(cb, { success: false, error: "Need at least 2 players." });

        try { assignRoles(gs); }
        catch (err) { return reply(cb, { success: false, error: err.message }); }

        const meta = gs.meta || (gs.meta = {});
        meta.startPending = true;
        reply(cb, { success: true });

        if (gs.players.some((player) => player.role === "illusionist")) {
            startIllusionistPregame(gs);
            return;
        }

        const finalizeLobbyGameStart = (gameState) => {
            clearPendingIllusionistTimer(gameState.roomId);
            const gm = gameState.meta || (gameState.meta = {});
            gm.startPending = false;
            gm.pendingIllusionistChoice = false;
            gm.illusionistId = gameState.players.find((player) => player.role === "illusionist")?.id || null;

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
        };

        finalizeLobbyGameStart(gs);
    });

    bindAckHandler("pregame:illusionistInfect", ({ roomId, targetId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return reply(cb, { success: false, error: "Room not found." });
        updateRoomActivity(roomId);

        const actor = gs.players.find((player) => player.id === socket.id);
        if (!actor || actor.role !== "illusionist") {
            return reply(cb, { success: false, error: "Not authorized." });
        }

        if (!gs.meta?.pendingIllusionistChoice || gs.meta?.illusionistId !== socket.id) {
            return reply(cb, { success: false, error: "The manifestation is already resolved." });
        }

        const result = resolveIllusionistInfection(gs, targetId || null);
        reply(cb, result);
    });
};
