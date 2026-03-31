/**
 * App.jsx — Screen router. Role reveal screen. Final.
 */
import { useState } from "react";
import { useSocketEvent, getSocket } from "./hooks/useSocket";
import Lobby from "./pages/Lobby.jsx";
import Game from "./pages/Game.jsx";

const SERVER = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const ROLE_COLORS = {
    gnosia: "#9b30ff", engineer: "#00f5ff", doctor: "#b0ffb8",
    guardian: "#ffd700", human: "#c8b8ff",
};
const ROLE_ICONS = { gnosia: "👁", engineer: "⚡", doctor: "☤", guardian: "🛡", human: "◈" };

function RoleReveal({ roleData }) {
    const color = ROLE_COLORS[roleData.role] || "#c8b8ff";
    const icon = ROLE_ICONS[roleData.role] || "◈";
    return (
        <div className="crt star-bg" style={{
            position: "fixed", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 24, padding: 32, zIndex: 50,
            animation: "fadeIn 0.4s ease",
        }}>
            <p style={{ fontSize: 9, color: "#4a3060", letterSpacing: "0.2em" }}>
                YOUR DESIGNATION
            </p>
            <div style={{
                border: `2px solid ${color}66`, padding: 40,
                maxWidth: 440, width: "100%",
                background: roleData.role === "gnosia" ? "#13002588" : "#0d002088",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
                boxShadow: `0 0 40px ${color}22`,
            }}>
                {/* Avatar + icon */}
                <div style={{
                    width: 96, height: 96,
                    border: `2px solid ${color}`,
                    boxShadow: `0 0 24px ${color}66`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 48, color,
                    background: color + "12",
                }}>
                    {icon}
                </div>
                <h2 style={{
                    fontSize: 22, color,
                    textShadow: `0 0 16px ${color}aa`,
                    letterSpacing: "0.08em",
                }}>
                    {roleData.role.toUpperCase()}
                </h2>
                <p style={{ fontSize: 9, color: "#8a7aa0", textAlign: "center", lineHeight: 2 }}>
                    {roleData.description}
                </p>
                {/* Gnosia allies */}
                {roleData.role === "gnosia" && roleData.gnosiaAllies?.length > 0 && (
                    <div style={{ width: "100%", borderTop: "1px solid #2a1a4a", paddingTop: 16 }}>
                        <p style={{
                            fontSize: 8, color: "#9b30ff", marginBottom: 10,
                            letterSpacing: "0.15em"
                        }}>
                            YOUR ALLIES
                        </p>
                        {roleData.gnosiaAllies.map(a => (
                            <div key={a.id} style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "8px 10px", marginBottom: 6,
                                border: "1px solid #9b30ff33", background: "#13002533",
                            }}>
                                <div style={{
                                    width: 36, height: 36, flexShrink: 0,
                                    overflow: "hidden", border: "1px solid #9b30ff44",
                                }}>
                                    <img src={`${SERVER}/profiles/${a.profileId}.jpg`} alt={a.username}
                                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                        onError={e => { e.target.style.display = "none"; }} />
                                </div>
                                <span style={{ fontSize: 10, color: "#c8b8ff" }}>{a.username}</span>
                                <span style={{ fontSize: 8, color: "#4a3060", marginLeft: "auto" }}>
                                    {a.profileName || ""}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <p style={{ fontSize: 8, color: "#2a1a3a", animation: "flicker 1s infinite" }}>
                MISSION BEGINS SHORTLY...
            </p>
        </div>
    );
}

export default function App() {
    const socket = getSocket();
    const [screen, setScreen] = useState("lobby");
    const [roleData, setRoleData] = useState(null);
    const [session, setSession] = useState({
        roomId: null, myId: null, myRole: null, myProfileId: null, allies: [], phase: null,
        gnosiaCount: null,
        lastPhasePayload: null,
    });

    useSocketEvent("game:roleAssigned", payload => {
        setRoleData(payload);
        setSession(s => ({ ...s, myRole: payload.role, allies: payload.gnosiaAllies || [] }));
        setScreen("roleReveal");
    });

    useSocketEvent("game:starting", ({ gnosiaCount }) => {
        setSession(s => ({ ...s, gnosiaCount: typeof gnosiaCount === "number" ? gnosiaCount : s.gnosiaCount }));
    });

    useSocketEvent("phase:changed", payload => {
        setSession(s => ({
            ...s,
            phase: payload.phase,
            lastPhasePayload: payload,
            gnosiaCount: typeof payload.gnosiaCount === "number" ? payload.gnosiaCount : s.gnosiaCount,
        }));
        if (screen !== "game") setScreen("game");
    });

    function handleLobbyReady(roomId, myId, myProfileId) {
        setSession(s => ({ ...s, roomId, myId, myProfileId }));
    }

    if (screen === "lobby") return <Lobby onReady={handleLobbyReady} />;
    if (screen === "roleReveal" && roleData) return <RoleReveal roleData={roleData} />;
    return <Game session={session} socket={socket} />;
}