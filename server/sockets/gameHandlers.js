const { getRoom, updateRoomActivity } = require("../rooms/roomManager");
const { isGnosiaRole, appearsGnosiaToEngineer, getDoctorRevealRole } = require("../game/roles");
const stateMachine = require("../game/stateMachine");
const nightResolver = require("../game/nightResolver");

module.exports = function registerGameHandlers(io, socket, { bindAckHandler, reply }) {
    
    bindAckHandler("phase:skip", ({ roomId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return reply(cb, { success: false, error: "Room not found." });
        updateRoomActivity(roomId);
        const player = gs.players.find(p => p.id === socket.id && p.alive);
        if (!player) return reply(cb, { success: false, error: "Not allowed." });

        if (gs.phase !== "DAY_DISCUSSION" && gs.phase !== "AFTERNOON") {
            return reply(cb, { success: false, error: "Cannot skip right now." });
        }

        if (gs.skipVotes[socket.id]) return reply(cb, { success: true });

        gs.skipVotes[socket.id] = true;
        const skipCount = Object.keys(gs.skipVotes).length;
        const aliveCount = gs.players.filter(p => p.alive).length;

        const voterPayload = Object.keys(gs.skipVotes).map(id => {
            const p = gs.players.find(x => x.id === id);
            return p ? { id: p.id, username: p.username, profileId: p.profileId } : null;
        }).filter(Boolean);
        io.to(roomId).emit("phase:skip:updated", voterPayload);

        if (skipCount >= aliveCount) {
            gs.skipVotes = {};
            stateMachine.forceAdvance(gs, null);
        }
        reply(cb, { success: true });
    });

    bindAckHandler("vote:submit", ({ roomId, targetId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return reply(cb, { success: false, error: "Room not found." });
        updateRoomActivity(roomId);
        if (gs.phase !== "VOTING") return reply(cb, { success: false, error: "Not voting phase." });

        const voter = gs.players.find(p => p.id === socket.id && p.alive);
        if (!voter) return reply(cb, { success: false, error: "Cannot vote." });
        const target = gs.players.find(p => p.id === targetId && p.alive);
        if (!target) return reply(cb, { success: false, error: "Invalid target." });
        if (targetId === socket.id) return reply(cb, { success: false, error: "Cannot vote yourself." });

        if (gs.votes[socket.id]) {
            return reply(cb, { success: false, error: "Vote already locked. You cannot change your vote." });
        }

        gs.votes[socket.id] = targetId;
        voter.voteTarget = targetId;
        reply(cb, { success: true });

        const votesCast = Object.keys(gs.votes).length;
        const totalAlive = gs.players.filter(p => p.alive).length;
        io.to(roomId).emit("vote:progress", { votesCast, totalAlive });

        if (votesCast === totalAlive) {
            stateMachine.endVotingEarly(gs);
        }
    });

    bindAckHandler("vote:dismiss", ({ roomId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return reply(cb, { success: false, error: "Room not found." });
        updateRoomActivity(roomId);
        if (gs.phase !== "VOTING") return reply(cb, { success: false, error: "Not voting phase." });

        const lawyer = gs.players.find(p => p.id === socket.id && p.alive);
        if (!lawyer) return reply(cb, { success: false, error: "Not allowed." });
        if (lawyer.role !== "lawyer") return reply(cb, { success: false, error: "Not authorized." });
        if (lawyer.dismissed) return reply(cb, { success: false, error: "Dismiss already used." });

        lawyer.dismissed = true;
        gs.votes = {};
        gs.skipVotes = {};
        reply(cb, { success: true });

        io.to(roomId).emit("vote:dismissed", {
            byUsername: lawyer.username,
            message: "Vote Cancelled",
        });
        stateMachine.dismissVoting(gs);
    });

    bindAckHandler("night:action", ({ roomId, actionType, targetId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return reply(cb, { success: false, error: "Room not found." });
        updateRoomActivity(roomId);
        if (gs.phase !== "NIGHT") return reply(cb, { success: false, error: "Not night phase." });

        const actor = gs.players.find(p => p.id === socket.id && p.alive);
        if (!actor) return reply(cb, { success: false, error: "Cannot act." });

        const { nightActions, players } = gs;

        switch (actionType) {
            case "gnosia_vote": {
                if (!isGnosiaRole(actor.role)) return reply(cb, { success: false, error: "Not authorized." });
                if (nightActions.gnosiaVotes[socket.id]) return reply(cb, { success: false, error: "Action already submitted." });
                if (targetId !== "skip") {
                    const target = players.find(p => p.id === targetId && p.alive && p.id !== socket.id);
                    if (!target) return reply(cb, { success: false, error: "Invalid target." });
                    if (isGnosiaRole(target.role)) return reply(cb, { success: false, error: "Cannot vote for an ally." });
                }
                nightActions.gnosiaVotes[socket.id] = targetId;
                const gCount = players.filter((player) => player.alive && isGnosiaRole(player.role)).length;
                const vIn = Object.keys(nightActions.gnosiaVotes).length;
                io.to(`${roomId}:gnosia`).emit("night:gnosiaVoteProgress", { votesIn: vIn, totalGnosia: gCount });
                reply(cb, { success: true });
                break;
            }
            case "engineer": {
                if (actor.role !== "engineer") return reply(cb, { success: false, error: "Not authorized." });
                if (nightActions.engineerTarget) return reply(cb, { success: false, error: "Action already submitted." });
                const target = players.find(p => p.id === targetId && p.alive && p.id !== socket.id);
                if (!target) return reply(cb, { success: false, error: "Invalid target." });
                nightActions.engineerTarget = targetId;
                reply(cb, { success: true });

                const isGnosia = appearsGnosiaToEngineer(target);
                io.to(actor.id).emit("night:scanResult", {
                    targetId,
                    isGnosia,
                    targetUsername: target.username,
                });

                if (isGnosia) {
                    io.to(targetId).emit("night:scannedAlert", {
                        message: "You have been scanned by the Engineer.",
                    });
                }
                break;
            }
            case "doctor": {
                if (actor.role !== "doctor") return reply(cb, { success: false, error: "Not authorized." });
                if (nightActions.doctorTarget) return reply(cb, { success: false, error: "Action already submitted." });
                const target = players.find(p => p.id === targetId && p.inColdSleep);
                if (!target) return reply(cb, { success: false, error: "Target not in Cold Sleep." });
                nightActions.doctorTarget = targetId;
                reply(cb, { success: true });

                io.to(actor.id).emit("night:inspectResult", {
                    targetId,
                    role: getDoctorRevealRole(target),
                    targetUsername: target.username,
                    error: null,
                });
                break;
            }
            case "guardian": {
                if (actor.role !== "guardian") return reply(cb, { success: false, error: "Not authorized." });
                if (nightActions.guardianTarget) return reply(cb, { success: false, error: "Action already submitted." });
                if (targetId === socket.id) return reply(cb, { success: false, error: "Cannot self-protect." });
                const target = players.find(p => p.id === targetId && p.alive);
                if (!target) return reply(cb, { success: false, error: "Invalid target." });
                nightActions.guardianTarget = targetId;
                reply(cb, { success: true });
                break;
            }
            default:
                return reply(cb, { success: false, error: "Unknown action." });
        }

        if (nightResolver.allNightActionsSubmitted(gs)) {
            nightResolver.scheduleNightResolution(gs, 500);
        }
    });

    bindAckHandler("phase:forceAdvance", ({ roomId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return reply(cb, { success: false, error: "Room not found." });
        updateRoomActivity(roomId);
        reply(cb, stateMachine.forceAdvance(gs, socket.id));
    });
};
