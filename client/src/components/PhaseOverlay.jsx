/**
 * PhaseOverlay.jsx — Full-screen phase announcements. Redesigned.
 */
import { useEffect, useState } from "react";

const META = {
    DAY_DISCUSSION: { label: "DAY DISCUSSION", icon: "☀", color: "#00f5ff", sub: "Discuss. Accuse. Survive.", delay: 3000 },
    VOTING: { label: "VOTING", icon: "⚖", color: "#ffd700", sub: "Vote someone into Cold Sleep.", delay: 3000 },
    AFTERNOON: { label: "AFTERNOON", icon: "🌅", color: "#ffb347", sub: "A moment before the dark.", delay: 2500 },
    NIGHT: { label: "NIGHT", icon: "🌑", color: "#9b30ff", sub: "The Gnosia move in silence.", delay: 4000 },
    MORNING: { label: "MORNING", icon: "🌄", color: "#ff9ef5", sub: "The night's results are revealed.", delay: 7000 },
};

export default function PhaseOverlay({ phase, morningReport, round, onDismiss }) {
    const [visible, setVisible] = useState(true);
    const meta = META[phase];

    // ⚠ ALL hooks must be called unconditionally — no early returns before this.
    useEffect(() => {
        if (!meta) return; // guard inside, not before the hook
        setVisible(true);
        const t = setTimeout(() => { setVisible(false); onDismiss?.(); }, meta.delay);
        return () => clearTimeout(t);
    }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

    // Early returns AFTER all hooks
    if (!meta) return null;
    if (!visible) return null;

    return (
        <div onClick={() => { setVisible(false); onDismiss?.(); }}
            style={{
                position: "fixed", inset: 0, zIndex: 50,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 20, padding: 32, cursor: "pointer",
                background: `${meta.color}08`,
                backdropFilter: "blur(2px)",
                animation: "fadeIn 0.3s ease",
            }}>
            {/* Backdrop panel */}
            <div style={{
                position: "absolute", inset: 0,
                background: `linear-gradient(180deg, #07000fee 0%, ${meta.color}06 50%, #07000fee 100%)`,
                pointerEvents: "none",
            }} />
            {/* Scanlines */}
            <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.08) 2px,rgba(0,0,0,0.08) 4px)",
            }} />

            <div style={{
                position: "relative", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 20
            }}>
                {round > 0 && (
                    <span style={{
                        fontSize: 9, color: meta.color + "88",
                        border: `1px solid ${meta.color}33`, padding: "5px 14px"
                    }}>
                        ROUND {round}
                    </span>
                )}

                <div style={{
                    fontSize: 72, filter: `drop-shadow(0 0 30px ${meta.color})`,
                    animation: "fadeInUp 0.4s ease"
                }}>
                    {meta.icon}
                </div>

                <h1 style={{
                    fontSize: 28, letterSpacing: "0.1em", textAlign: "center",
                    color: meta.color,
                    textShadow: `0 0 20px ${meta.color}aa, 0 0 40px ${meta.color}44`,
                    animation: "fadeInUp 0.5s ease",
                }}>
                    {meta.label}
                </h1>

                <p style={{
                    fontSize: 10, color: "#4a3060", textAlign: "center",
                    animation: "fadeInUp 0.6s ease"
                }}>
                    {meta.sub}
                </p>

                {/* Morning report */}
                {phase === "MORNING" && morningReport && (
                    <div style={{
                        border: `1px solid ${meta.color}33`, padding: 24,
                        minWidth: 280, maxWidth: 400,
                        display: "flex", flexDirection: "column", gap: 16,
                        background: "#0d002088",
                        animation: "fadeInUp 0.7s ease",
                    }}>
                        {morningReport.killed ? (
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 8, color: "#4a3060", marginBottom: 8 }}>ELIMINATED BY GNOSIA</div>
                                <div className="glow-danger" style={{ fontSize: 14 }}>
                                    {morningReport.killedUsername || "Unknown"}
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: "center", fontSize: 10, color: "#4a3060" }}>
                                {morningReport.wasSaved 
                                    ? "Gnosia activity was detected, but no one was killed."
                                    : "No kill this night."}
                            </div>
                        )}
                        {morningReport.coldSleep && (
                            <div style={{ textAlign: "center", borderTop: "1px solid #1a0a2a", paddingTop: 16 }}>
                                <div style={{ fontSize: 8, color: "#4a3060", marginBottom: 8 }}>SENT TO COLD SLEEP</div>
                                <div className="glow-gold" style={{ fontSize: 14 }}>
                                    {morningReport.coldSleepUsername || "Unknown"}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <p style={{ fontSize: 8, color: "#2a1a3a", animation: "fadeInUp 0.8s ease" }}>
                    CLICK TO CONTINUE
                </p>
            </div>
        </div>
    );
}