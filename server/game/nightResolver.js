/**
 * nightResolver.js
 * Resolves all night actions in strict order:
 *   1. Guardian Angel protection applied
 *   2. Gnosia kill resolved (blocked if target is protected)
 *   3. Engineer scan resolved (SCANNED alert sent if target is Gnosia)
 *   4. Doctor inspection resolved
 *
 * Called by index.js once all actions are submitted OR the night timer expires.
 * Calls stateMachine.advanceToMorning() when done.
 *
 * io is injected via init().
 */

const { advanceToMorning } = require("./stateMachine");

let _io = null;
const POST_NIGHT_REVEAL_MS = 6500;

/**
 * @param {object} io — Socket.io server instance
 */
function init(io) {
    _io = io;
}

// ─────────────────────────────────────────────
// MAIN RESOLVER
// ─────────────────────────────────────────────

/**
 * Resolves all night actions against the current gameState.
 * Mutates gameState in place, then advances to MORNING.
 *
 * @param {object} gameState
 */
function resolveNight(gameState) {
    const { nightActions, players } = gameState;

    console.log(`[Night] Resolving night actions for room ${gameState.roomId}`);
    console.log(`[Night] Actions:`, nightActions);

    // Reset per-night flags on all players first
    for (const p of players) {
        p.protected = false;
        p.scanned = false;
    }

    // ── Step 1: Guardian Angel ───────────────────────────────────────
    const guardianResult = resolveGuardian(gameState);

    // ── Step 2: Gnosia Kill ──────────────────────────────────────────
    const killResult = resolveGnosiaKill(gameState);

    // ── Step 3: Engineer Scan ────────────────────────────────────────
    const scanResult = resolveEngineerScan(gameState);

    // ── Step 4: Doctor Inspection ────────────────────────────────────
    const doctorResult = resolveDoctorInspect(gameState);

    // ── Build morning report ──────────────────────────────────────────
    gameState.morningReport = {
        killed: killResult.killed,
        savedBy: killResult.savedBy,
        coldSleep: gameState.morningReport.coldSleep, // set by vote resolver, preserve it
    };

    // ── Deliver private results to role holders ───────────────────────
    deliverPrivateResults(gameState, { guardianResult, killResult, scanResult, doctorResult });

    // ── Deliver Guardian outcome messaging ────────────────────────────
    deliverGuardianOutcome(gameState, { guardianResult, killResult });

    console.log(`[Night] Resolution complete. Kill: ${killResult.killed}, Saved: ${killResult.savedBy}`);

    // ── Advance FSM to MORNING ────────────────────────────────────────
    // Important: show role result UI first, then advance.
    setTimeout(() => advanceToMorning(gameState), POST_NIGHT_REVEAL_MS);
}

// ─────────────────────────────────────────────
// STEP 1 — GUARDIAN ANGEL
// ─────────────────────────────────────────────

function resolveGuardian(gameState) {
    const { nightActions, players } = gameState;
    const targetId = nightActions.guardianTarget;

    if (!targetId) return { protected: null };

    const target = players.find((p) => p.id === targetId && p.alive);
    if (!target) return { protected: null };

    target.protected = true;
    console.log(`[Night] Guardian protected: ${target.username}`);

    return { protected: targetId };
}

// ─────────────────────────────────────────────
// STEP 2 — GNOSIA KILL
// ─────────────────────────────────────────────

function resolveGnosiaKill(gameState) {
    const { nightActions, players } = gameState;

    // Resolve majority from gnosiaVotes
    const targetId = resolveGnosiaVoteMajority(nightActions.gnosiaVotes);
    nightActions.gnosiaTarget = targetId;

    if (!targetId) {
        console.log(`[Night] Gnosia did not agree on a target — no kill.`);
        return { killed: null, savedBy: null };
    }

    const target = players.find((p) => p.id === targetId && p.alive);
    if (!target) return { killed: null, savedBy: null };

    // Check Guardian protection
    if (target.protected) {
        console.log(`[Night] Kill on ${target.username} blocked by Guardian Angel.`);
        return { killed: null, savedBy: "guardian" };
    }

    // Kill confirmed
    target.alive = false;
    console.log(`[Night] ${target.username} was killed by Gnosia.`);

    return { killed: targetId, savedBy: null };
}

/**
 * Resolves Gnosia kill vote by simple majority.
 * Ties → no kill.
 * @param {object} votes — { [voterId]: targetId }
 * @returns {string|null} winning targetId or null
 */
function resolveGnosiaVoteMajority(votes = {}) {
    const tally = {};
    for (const targetId of Object.values(votes)) {
        tally[targetId] = (tally[targetId] || 0) + 1;
    }

    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return null;

    const [topId, topCount] = entries[0];
    const isTie = entries.length > 1 && entries[1][1] === topCount;

    return isTie ? null : topId;
}

// ─────────────────────────────────────────────
// STEP 3 — ENGINEER SCAN
// ─────────────────────────────────────────────

function resolveEngineerScan(gameState) {
    const { nightActions, players } = gameState;
    const targetId = nightActions.engineerTarget;

    if (!targetId) return { scanned: null, isGnosia: null };

    const target = players.find((p) => p.id === targetId);
    if (!target) return { scanned: null, isGnosia: null };

    const isGnosia = target.role === "gnosia";
    target.scanned = true;

    console.log(`[Night] Engineer scanned ${target.username} → ${isGnosia ? "GNOSIA" : "NOT GNOSIA"}`);

    // Scanned alerts are delivered immediately on action submission (index.js)

    return { scanned: targetId, isGnosia };
}

// ─────────────────────────────────────────────
// STEP 4 — DOCTOR INSPECTION
// ─────────────────────────────────────────────

function resolveDoctorInspect(gameState) {
    const { nightActions, players } = gameState;
    const targetId = nightActions.doctorTarget;

    if (!targetId) return { inspected: null, role: null };

    // Doctor can only inspect players already in Cold Sleep
    const target = players.find((p) => p.id === targetId && p.inColdSleep);
    if (!target) {
        console.log(`[Night] Doctor target ${targetId} is not in Cold Sleep — invalid.`);
        return { inspected: null, role: null, error: "Target is not in Cold Sleep." };
    }

    console.log(`[Night] Doctor inspected ${target.username} → ${target.role}`);

    return { inspected: targetId, role: target.role };
}

// ─────────────────────────────────────────────
// PRIVATE RESULT DELIVERY
// ─────────────────────────────────────────────

/**
 * Sends private night results to each role holder.
 * These are secret — never broadcast to the room.
 */
function deliverPrivateResults(gameState, results) {
    if (!_io) return;

    const { players } = gameState;
    const { scanResult, doctorResult } = results;

    // Engineer receives their scan result
    if (scanResult.scanned !== null) {
        const engineer = players.find((p) => p.role === "engineer" && p.alive);
        if (engineer) {
            _io.to(engineer.id).emit("night:scanResult", {
                targetId: scanResult.scanned,
                isGnosia: scanResult.isGnosia,
                targetUsername: players.find((p) => p.id === scanResult.scanned)?.username,
            });
        }
    }

    // Doctor receives their inspection result
    if (doctorResult.inspected !== null) {
        const doctor = players.find((p) => p.role === "doctor" && p.alive);
        if (doctor) {
            _io.to(doctor.id).emit("night:inspectResult", {
                targetId: doctorResult.inspected,
                role: doctorResult.role,
                targetUsername: players.find((p) => p.id === doctorResult.inspected)?.username,
                error: doctorResult.error || null,
            });
        }
    }
}

function deliverGuardianOutcome(gameState, { guardianResult, killResult }) {
    if (!_io) return;
    const { players } = gameState;

    const guardian = players.find((p) => p.role === "guardian" && p.alive);
    if (!guardian) return;

    // Only show success message if a kill was blocked by guardian.
    if (killResult.savedBy !== "guardian") return;
    const protectedId = guardianResult.protected;
    const protectedName = players.find(p => p.id === protectedId)?.username || "a crew member";

    _io.to(guardian.id).emit("ui:toast", {
        variant: "gold",
        title: "PROTECTION SUCCESS",
        message: `You protected ${protectedName} from Gnosia.`,
        durationMs: 6500,
    });

    // Alert gnosia channel (they know a kill was blocked)
    _io.to(`${gameState.roomId}:gnosia`).emit("ui:toast", {
        variant: "gold",
        title: "KILL BLOCKED",
        message: `Guardian Angel protected ${protectedName}.`,
        durationMs: 6500,
    });
}

// ─────────────────────────────────────────────
// ACTION SUBMISSION TRACKER
// ─────────────────────────────────────────────

/**
 * Checks whether all living role holders have submitted their night action.
 * Used to early-resolve night if everyone is done before the timer expires.
 *
 * @param {object} gameState
 * @returns {boolean}
 */
function allNightActionsSubmitted(gameState) {
    const { players, nightActions, settings } = gameState;
    const alive = players.filter((p) => p.alive);

    const hasRole = (role) => alive.some((p) => p.role === role);
    const gnosiaAlive = alive.filter((p) => p.role === "gnosia");

    // Gnosia — all alive Gnosia must have voted
    const gnosiaVoteCount = Object.keys(nightActions.gnosiaVotes).length;
    if (gnosiaAlive.length > 0 && gnosiaVoteCount < gnosiaAlive.length) return false;

    // Engineer
    if (settings.hasEngineer && hasRole("engineer") && !nightActions.engineerTarget) return false;

    // Doctor
    if (settings.hasDoctor && hasRole("doctor") && !nightActions.doctorTarget) return false;

    // Guardian
    if (settings.hasGuardian && hasRole("guardian") && !nightActions.guardianTarget) return false;

    return true;
}

module.exports = {
    init,
    resolveNight,
    allNightActionsSubmitted,
};