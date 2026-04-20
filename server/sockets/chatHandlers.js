const { getRoom, updateRoomActivity } = require("../rooms/roomManager");
const { isGnosiaRole } = require("../game/roles");
const crypto = require("crypto");

function buildMessage(sender, text, channel, targetPersona = null) {
    return {
        id: crypto.randomUUID(),
        channel,
        text,
        senderId: targetPersona ? targetPersona.id : sender.id,
        senderName: targetPersona ? targetPersona.username : sender.username,
        profileId: targetPersona ? targetPersona.profileId : sender.profileId,
        isAlive: targetPersona ? targetPersona.alive : sender.alive,
        timestamp: Date.now(),
    };
}

module.exports = function registerChatHandlers(io, socket, { bindAckHandler, reply }) {
    
    bindAckHandler("chat:message", ({ roomId, channel, text, targetId }, cb) => {
        const gs = getRoom(roomId);
        if (!gs) return reply(cb, { success: false, error: "Room not found." });
        updateRoomActivity(roomId);

        const sender = gs.players.find(p => p.id === socket.id);
        if (!sender) return reply(cb, { success: false, error: "You have been disconnected from the room." });

        const trimmed = (text || "").trim();
        if (!trimmed) return reply(cb, { success: false, error: "Empty message." });
        if (trimmed.length > 300) return reply(cb, { success: false, error: "Max 300 characters." });

        const { phase } = gs;

        let targetPersona = null;
        if (targetId && sender.role === "illusionist" && channel === "public") {
            targetPersona = gs.players.find(p => p.id === targetId);
        }

        if (channel === "public") {
            if (!sender.alive) {
                const msg = buildMessage(sender, trimmed, "public", targetPersona);
                const deadPlayers = gs.players.filter(p => !p.alive).map(p => p.id);
                deadPlayers.forEach(deadId => {
                    io.to(deadId).emit("chat:message", msg);
                });
                return reply(cb, { success: true });
            }
            
            if (phase === "NIGHT") return reply(cb, { success: false, error: "Public chat closed at night." });
            if (phase === "VOTING") return reply(cb, { success: false, error: "Public chat closed during voting." });
            
            const msg = buildMessage(sender, trimmed, "public", targetPersona);
            io.to(roomId).emit("chat:message", msg);
            return reply(cb, { success: true });
        }

        if (channel === "gnosia") {
            if (!isGnosiaRole(sender.role)) return reply(cb, { success: false, error: "Channel not available." });
            if (phase !== "DAY_DISCUSSION" && phase !== "NIGHT")
                return reply(cb, { success: false, error: "Gnosia channel not active." });
            const msg = buildMessage(sender, trimmed, "gnosia");
            io.to(`${roomId}:gnosia`).emit("chat:message", msg);
            return reply(cb, { success: true });
        }

        reply(cb, { success: false, error: "Invalid channel." });
    });
};
