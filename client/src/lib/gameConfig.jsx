/**
 * gameConfig.js — Role info, colors, and phase configurations.
 * Extracted from Game.jsx for better maintainability.
 */
import { IoIosInfinite } from "react-icons/io";

export const PHASE_COLORS = {
    DAY_DISCUSSION: "#00f5ff",
    VOTING: "#ffd700",
    AFTERNOON: "#ffb347",
    NIGHT: "#9b30ff",
    MORNING: "#ff9ef5",
    END: "#ff2a2a",
};

export const ROLE_COLORS = {
    gnosia: "#9b30ff",
    engineer: "#00f5ff",
    doctor: "#b0ffb8",
    guardian: "#ffd700",
    human: "#c8b8ff",
    lawyer: "#ff8833",
    traitor: "#ff4040",
    illusionist: "#9b30ff",
};

export const ROLE_INFO = {
    gnosia: {
        icon: "👁",
        desc: "Deceive the crew. Each night, coordinate with your allies to eliminate one human. You win when Gnosia outnumber humans.",
    },
    human: {
        icon: "◈",
        desc: "Identify and vote out all Gnosia before they take over the ship.",
    },
    engineer: {
        icon: "⚡",
        desc: "Each night, scan one player to learn if they are Gnosia. If they are, they receive a warning — not your identity.",
    },
    doctor: {
        icon: "☤",
        desc: "Each night, inspect one player in Cold Sleep to reveal their true role.",
    },
    guardian: {
        icon: "🛡",
        desc: "Each night, protect one other player. If the Gnosia target them, the kill is blocked.",
    },
    lawyer: {
        icon: "⚖",
        desc: "Once per game, you may dismiss the vote during any voting round — cancelling it entirely so no one is eliminated.",
    },
    traitor: {
        icon: "◈",
        desc: "You have no special ability, but you appear human to all scans and inspections. You win with the Gnosia.",
    },
    illusionist: {
        icon: <IoIosInfinite />,
        desc: "Before the mission begins, infect one crew member to turn them into Gnosia. After that, you act exactly like Gnosia and appear as Gnosia to all checks.",
    },
};

export const isGnosiaRole = (role) => role === "gnosia" || role === "illusionist";
