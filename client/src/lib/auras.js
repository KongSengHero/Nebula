/**
 * auras.js — Aura configurations and constants.
 * Extracted from PlayerCard.jsx and Game.jsx for better maintainability.
 */

export const buildAuraColumns = (specs, delayStep) =>
    specs.map(([left, bottom, width, height, rotate, thrust, layer], index) => ({
        left,
        bottom,
        width,
        height,
        rotate,
        thrust,
        layer,
        delay: index * delayStep,
    }));

export const RAGE_COLUMNS = buildAuraColumns([
    [50, 54, 22, 58, 0, 21, 8],
    [40, 49, 18, 48, -8, 17, 7],
    [60, 49, 18, 48, 8, 17, 7],
    [45, 51, 16, 53, -4, 18, 8],
    [55, 51, 16, 53, 4, 18, 8],
    [30, 40, 14, 41, -14, 14, 6],
    [70, 40, 14, 41, 14, 14, 6],
    [35, 42, 14, 43, -10, 15, 6],
    [65, 42, 14, 43, 10, 15, 6],
    [19, 30, 12, 34, -22, 10, 5],
    [81, 30, 12, 34, 22, 10, 5],
    [24, 32, 12, 36, -18, 11, 5],
    [76, 32, 12, 36, 18, 11, 5],
    [11, 19, 11, 26, -32, 8, 4],
    [89, 19, 11, 26, 32, 8, 4],
    [35, 17, 10, 21, -12, 5.5, 3],
    [65, 17, 10, 21, 12, 5.5, 3],
], 0.045);

export const GOLDEN_COLUMNS = buildAuraColumns([
    [50, 54, 22, 58, 0, 21, 8],
    [40, 49, 18, 48, -8, 17, 7],
    [60, 49, 18, 48, 8, 17, 7],
    [45, 51, 16, 53, -4, 18, 8],
    [55, 51, 16, 53, 4, 18, 8],
    [30, 40, 14, 41, -14, 14, 6],
    [70, 40, 14, 41, 14, 14, 6],
    [35, 42, 14, 43, -10, 15, 6],
    [65, 42, 14, 43, 10, 15, 6],
    [19, 30, 12, 34, -22, 10, 5],
    [81, 30, 12, 34, 22, 10, 5],
    [24, 32, 12, 36, -18, 11, 5],
    [76, 32, 12, 36, 18, 11, 5],
    [11, 19, 11, 26, -32, 8, 4],
    [89, 19, 11, 26, 32, 8, 4],
    [35, 17, 10, 21, -12, 5.5, 3],
    [65, 17, 10, 21, 12, 5.5, 3],
], 0.045);

export const GLACIER_COLUMNS = buildAuraColumns([
    [50, 50, 18, 78, 0, 10, 7],
    [39, 43, 15, 62, -8, 8, 6],
    [61, 43, 15, 62, 8, 8, 6],
    [27, 34, 14, 54, -16, 7, 5],
    [73, 34, 14, 54, 16, 7, 5],
    [16, 24, 12, 42, -26, 6, 4],
    [84, 24, 12, 42, 26, 6, 4],
    [9, 14, 10, 30, -34, 5, 3],
    [91, 14, 10, 30, 34, 5, 3],
], 0.065);

export const SPARKLE_COLUMNS = buildAuraColumns([
    [20, 60, 4, 4, 0, 8, 5],
    [80, 55, 5, 5, 0, 12, 5],
    [15, 35, 4, 4, 0, 10, 5],
    [85, 25, 6, 6, 0, 14, 5],
    [50, 70, 4, 4, 0, 10, 5],
    [30, 10, 5, 5, 0, 12, 5],
    [70, 8, 4, 4, 0, 8, 5],
], 0.25);

export const RED_SAIYAN_COLUMNS = buildAuraColumns([
    [50, 54, 22, 58, 0, 21, 8],
    [40, 49, 18, 48, -8, 17, 7],
    [60, 49, 18, 48, 8, 17, 7],
    [45, 51, 16, 53, -4, 18, 8],
    [55, 51, 16, 53, 4, 18, 8],
    [30, 40, 14, 41, -14, 14, 6],
    [70, 40, 14, 41, 14, 14, 6],
    [35, 42, 14, 43, -10, 15, 6],
    [65, 42, 14, 43, 10, 15, 6],
    [19, 30, 12, 34, -22, 10, 5],
    [81, 30, 12, 34, 22, 10, 5],
    [24, 32, 12, 36, -18, 11, 5],
    [76, 32, 12, 36, 18, 11, 5],
    [11, 19, 11, 26, -32, 8, 4],
    [89, 19, 11, 26, 32, 8, 4],
    [35, 17, 10, 21, -12, 5.5, 3],
    [65, 17, 10, 21, 12, 5.5, 3],
], 0.045);

export const RAINBOW_SPARKLE_COLUMNS = buildAuraColumns([
    [20, 60, 4, 4, 0, 8, 5],
    [80, 55, 5, 5, 0, 12, 5],
    [15, 35, 4, 4, 0, 10, 5],
    [85, 25, 6, 6, 0, 14, 5],
    [50, 70, 4, 4, 0, 10, 5],
    [30, 10, 5, 5, 0, 12, 5],
    [70, 8, 4, 4, 0, 8, 5],
], 0.25);

export const RAINBOW_SPARKLE_COLORS = [
    '#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#ff00ff', '#ff1493'
];

export const RED_SPARKLE_COLUMNS = buildAuraColumns([
    [20, 60, 4, 4, 0, 8, 5],
    [80, 55, 5, 5, 0, 12, 5],
    [15, 35, 4, 4, 0, 10, 5],
    [85, 25, 6, 6, 0, 14, 5],
    [50, 70, 4, 4, 0, 10, 5],
    [30, 10, 5, 5, 0, 12, 5],
    [70, 8, 4, 4, 0, 8, 5],
], 0.25);

export const AURA_CONFIG = {
    "aura-rage-mode": {
        label: "Rage Mode",
        columns: RAGE_COLUMNS,
    },
    "aura-golden-saiyan": {
        label: "Golden Saiyan",
        columns: GOLDEN_COLUMNS,
    },
    "aura-glacier": {
        label: "Glacier",
        columns: GLACIER_COLUMNS,
    },
    "aura-sunset": {
        label: "Sunset",
        columns: [],
    },
    "aura-glitch": {
        label: "Glitch",
        columns: [],
    },
    "aura-sparkle-white": {
        label: "White Sparkles",
        columns: SPARKLE_COLUMNS,
    },
    "aura-sparkle-yellow": {
        label: "Yellow Sparkles",
        columns: SPARKLE_COLUMNS,
    },
    "aura-sparkle-pink": {
        label: "Pink Sparkles",
        columns: SPARKLE_COLUMNS,
    },
    "aura-judgement": {
        label: "Judgement",
        columns: [],
    },
    "aura-red-saiyan": {
        label: "Red Saiyan",
        columns: RED_SAIYAN_COLUMNS,
    },
    "aura-halo": {
        label: "Halo",
        columns: [],
    },
    "aura-void": {
        label: "Void",
        columns: [],
    },
    "aura-sparkle-rainbow": {
        label: "Rainbow Sparkle",
        columns: RAINBOW_SPARKLE_COLUMNS,
    },
    "aura-sparkle-red": {
        label: "Red Sparkle",
        columns: RED_SPARKLE_COLUMNS,
    },
};

export const AURA_ROLL_OPTIONS = [
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
    "aura-sparkle-red"
];

export const AURA_PREVIEW = {
    "aura-rage-mode": {
        border: "#f5f5f588",
        shadow: "0 0 22px rgba(255, 255, 255, 0.16)",
        color: "#f5f5f5",
        label: "RAGE MODE",
    },
    "aura-golden-saiyan": {
        border: "#ffd70088",
        shadow: "0 0 28px rgba(255, 215, 0, 0.26)",
        color: "#ffd700",
        label: "GOLDEN SAIYAN",
    },
    "aura-glacier": {
        border: "#8fe8ff88",
        shadow: "0 0 28px rgba(113, 220, 255, 0.22)",
        color: "#8fe8ff",
        label: "GLACIER",
    },
    "aura-sunset": {
        border: "#ff450088",
        shadow: "0 0 28px rgba(255, 69, 0, 0.3)",
        color: "#ff8c00",
        label: "SUNSET",
    },
    "aura-glitch": {
        border: "#00ff0088",
        shadow: "0 0 22px rgba(0, 255, 0, 0.22)",
        color: "#00ff00",
        label: "GLITCH",
    },
    "aura-sparkle-white": {
        border: "#ffffff88",
        shadow: "0 0 22px rgba(255, 255, 255, 0.22)",
        color: "#ffffff",
        label: "WHITE SPARKLE",
    },
    "aura-sparkle-yellow": {
        border: "#fff62d88",
        shadow: "0 0 22px rgba(255, 246, 45, 0.22)",
        color: "#fff62d",
        label: "YELLOW SPARKLE",
    },
    "aura-sparkle-pink": {
        border: "#ff69b488",
        shadow: "0 0 22px rgba(255, 105, 180, 0.22)",
        color: "#ff69b4",
        label: "PINK SPARKLE",
    },
    "aura-judgement": {
        border: "#00f5ff88",
        shadow: "0 0 32px rgba(0, 245, 255, 0.28)",
        color: "#00f5ff",
        label: "JUDGEMENT",
    },
    "aura-red-saiyan": {
        border: "#ff6b6b88",
        shadow: "0 0 25px rgba(255, 107, 107, 0.24)",
        color: "#ff6b6b",
        label: "RED SAIYAN",
    },
    "aura-halo": {
        border: "#ffd70088",
        shadow: "0 0 20px rgba(255, 215, 0, 0.30)",
        color: "#ffd700",
        label: "HALO",
    },
    "aura-void": {
        border: "#4a008088",
        shadow: "0 0 30px rgba(74, 0, 128, 0.32)",
        color: "#4a0080",
        label: "VOID",
    },
    "aura-sparkle-rainbow": {
        border: "#ff00ff88",
        shadow: "0 0 26px rgba(255, 0, 255, 0.30)",
        color: "#ff00ff",
        label: "RAINBOW SPARKLE",
    },
    "aura-sparkle-red": {
        border: "#ff6b6b88",
        shadow: "0 0 22px rgba(255, 107, 107, 0.28)",
        color: "#ff6b6b",
        label: "RED SPARKLE",
    },
};
