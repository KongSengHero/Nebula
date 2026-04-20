import { useEffect } from "react";
import { useSocketEvent } from "./useSocket";
import { getRandomEmotes } from "../components/EmoteWheel.jsx";
import { animate } from "animejs";

export function useGameSocket({
    roomId, myId, myRole, socket,
    players, setPlayers,
    setAllies,
    setPhase,
    setRound,
    setTimers,
    setMorningReport,
    setShowOverlay,
    setGameOver,
    setSelectedTarget,
    setNightSubmitted,
    setActionError,
    setActionMsg,
    setVoteProgress,
    setGnosiaVP,
    setScanResult,
    setInspectResult,
    setGuardianResult,
    setScannedAlert,
    setHasVoted,
    setHasLawyerDismissed,
    setVoteDismissed,
    showResultModal,
    setVoteReveal,
    setVoteBreakdown,
    setSkipVotes,
    setLostConnectionNotice,
    setPubMsgs,
    setGnMsgs,
    setUnreadPub,
    setUnreadGn,
    desktopChat,
    mobileChatOpen,
    activeChatTab,
    setPlayerEmotes,
    emoteTimeoutsRef,
}) {
    // ── SOCKET EVENT HANDLERS ─────────────────────────────────────────

    useSocketEvent("chat:message", msg => {
        const formatted = {
            ...msg,
            time: new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        if (msg.channel === "gnosia") {
            setGnMsgs(p => [...p, formatted]);
            const isViewingGn = (desktopChat || mobileChatOpen) && activeChatTab === "gnosia";
            if (!isViewingGn) setUnreadGn(n => n + 1);
        } else {
            setPubMsgs(p => [...p, formatted]);
            const isViewingPub = (desktopChat || mobileChatOpen) && activeChatTab === "public";
            if (!isViewingPub) setUnreadPub(n => n + 1);
        }
    });

    useSocketEvent("phase:changed", ({ phase: p, round: r, timers: t, players: pl, skipVotes: sv, morningReport: mr }) => {
        setPhase(p); setRound(r); setTimers(t); setPlayers(pl);
        setSelectedTarget(null); setNightSubmitted(false);
        setActionError(""); setActionMsg(""); setHasVoted(false);
        setShowOverlay(true); setScanResult(null); setInspectResult(null); setGuardianResult(null);
        if (p !== "VOTE_REVEAL" && p !== "AFTERNOON") setVoteBreakdown(null);
        setSkipVotes(Array.isArray(sv) ? sv : []);
        setMorningReport(mr || null);

        const phaseLabels = {
            DAY_DISCUSSION: "☀ Day Discussion begins.",
            VOTING: "⚖ Voting phase — choose wisely.",
            AFTERNOON: "🌅 Afternoon cooldown.",
            NIGHT: "🌑 Night has fallen.",
            MORNING: "🌄 Morning — results revealed.",
        };
        const label = phaseLabels[p];
        if (label) {
            const sys = { id: Date.now(), type: "system", text: label };
            setPubMsgs(p => [...p, sys]);
            const isGnosia = myRole === "gnosia" || myRole === "illusionist";
            if (isGnosia) setGnMsgs(p => [...p, sys]);
        }
    });

    useSocketEvent("phase:skip:updated", voters => setSkipVotes(Array.isArray(voters) ? voters : []));
    useSocketEvent("vote:progress", ({ votesCast, totalAlive }) => setVoteProgress({ votesCast, totalAlive }));
    useSocketEvent("vote:dismissed", ({ byUsername, message }) => {
        setVoteDismissed({ byUsername, message });
        setTimeout(() => setVoteDismissed(null), 3500);
    });

    useSocketEvent("vote:result", result => {
        setVoteBreakdown(result.votes || {});
        setVoteReveal({ eliminatedId: result.eliminated || null, eliminatedUsername: result.eliminatedUsername || null, reason: result.reason || null });
        setTimeout(() => {
            setMorningReport(prev => ({ ...(prev || {}), coldSleep: result.eliminated, coldSleepUsername: result.eliminatedUsername }));
            if (result.eliminated) setPlayers(prev => prev.map(p => p.id === result.eliminated ? { ...p, alive: false, inColdSleep: true } : p));
            setVoteReveal(null);
        }, 4200);
    });

    useSocketEvent("night:scanResult", r => {
        setScanResult(r);
        showResultModal({ variant: r?.isGnosia ? "danger" : "info", title: "ENGINEER SCAN RESULT", message: `${r?.targetUsername || "Target"} is ${r?.isGnosia ? "GNOSIA" : "HUMAN"}.` });
    });

    useSocketEvent("night:inspectResult", r => {
        setInspectResult(r); if (r?.error) return;
        showResultModal({ variant: r?.role === "gnosia" ? "danger" : "success", title: "DOCTOR INSPECTION RESULT", message: `${r?.targetUsername || "Target"} was ${r?.role === "gnosia" ? "GNOSIA" : "HUMAN"}.` });
    });

    useSocketEvent("night:guardianResult", r => {
        setGuardianResult(r);
        showResultModal({ variant: r?.worked ? "success" : "info", title: "PROTECTION OUTCOME", message: r?.worked ? `You protected ${r?.targetUsername || "Target"} from the Gnosia!` : `Your ward ${r?.targetUsername || "Target"} was not targeted tonight.` });
    });

    useSocketEvent("night:scannedAlert", payload => {
        setScannedAlert(true); setTimeout(() => setScannedAlert(false), 8000);
        showResultModal({ variant: "danger", title: "GNOSIA ALERT", message: payload?.message || "You have been scanned by the Engineer." });
    });

    useSocketEvent("ui:toast", t => showResultModal({ variant: t?.variant || "info", title: t?.title || "NOTICE", message: t?.message || "", durationMs: t?.durationMs }));
    useSocketEvent("night:gnosiaVoteProgress", ({ votesIn, totalGnosia }) => { setGnosiaVP({ votesIn, totalGnosia }); setActionMsg(`${votesIn}/${totalGnosia} Gnosia voted`); });
    useSocketEvent("game:over", r => { setGameOver(r); setPhase("END"); });
    useSocketEvent("player:disconnected", ({ socketId }) => { setPlayers(prev => prev.map(p => p.id === socketId ? { ...p, disconnected: true } : p)); });
    useSocketEvent("player:reconnected", ({ previousId, newId }) => { setPlayers(prev => prev.map(p => p.id === previousId ? { ...p, id: newId, disconnected: false } : p)); });
    useSocketEvent("player:lostConnection", ({ username, playerId }) => { setLostConnectionNotice(`${username} lost connection.`); setPlayers(prev => prev.filter(p => p.id !== playerId)); setTimeout(() => setLostConnectionNotice(""), 7000); });
    useSocketEvent("player:auraUpdated", ({ playerId, aura, rollsRemaining }) => { setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, aura, rollsRemaining } : p)); });

    useSocketEvent("player:emote", ({ playerId, emote }) => {
        setPlayerEmotes(prev => ({ ...prev, [playerId]: emote }));
        clearTimeout(emoteTimeoutsRef.current[playerId]);
        emoteTimeoutsRef.current[playerId] = setTimeout(() => {
            setPlayerEmotes(prev => { const n = { ...prev }; delete n[playerId]; return n; });
        }, 5000);
    });

    useSocketEvent("game:roleAssigned", rolePayload => {
        const isGnosia = rolePayload.role === "gnosia" || rolePayload.role === "illusionist";
        if (isGnosia && rolePayload.gnosiaAllies) setAllies(rolePayload.gnosiaAllies);
    });
}
