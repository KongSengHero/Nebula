export default function ReconnectingOverlay({ visible, message }) {
    if (!visible) return null;
    return (
        <div style={{ position: "fixed", top: 56, left: "50%", transform: "translateX(-50%)", zIndex: 999999, pointerEvents: "none" }}>
            <div style={{
                border: "1px solid #00f5ff55",
                background: "#0d0020f2",
                color: "#00f5ff",
                padding: "10px 16px",
                boxShadow: "0 0 20px #000",
                fontSize: 8,
                fontFamily: "Press Start 2P, monospace",
                display: "flex",
                alignItems: "center",
                gap: 8,
            }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00f5ff", boxShadow: "0 0 12px #00f5ff", animation: "bounce 1.2s ease-in-out infinite" }} />
                <span>{message || "RECONNECTING..."}</span>
            </div>
            <div style={{ textAlign: "center", marginTop: 8 }}>
                <p style={{ fontSize: 8, color: "#4a3060", margin: 0 }}>
                    Keeping game state on screen while reconnecting...
                </p>
            </div>
            <style>{`
                @keyframes bounce { 0%,100%{transform:translateY(0);opacity:0.6} 50%{transform:translateY(-6px);opacity:1} }
            `}</style>
        </div>
    );
}
