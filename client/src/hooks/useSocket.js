/**
 * useSocket.js
 * Manages the single Socket.io connection for the entire app.
 *
 * Usage:
 *   const { socket, connected, emit } = useSocket();
 *
 * Pattern:
 *   - One socket instance created at app level, passed via context or prop
 *   - Components subscribe to events via useEffect + socket.on / socket.off
 *   - emit() wraps socket.emit with optional ack callback
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

// Singleton socket — created once, reused across re-renders
let socketInstance = null;

function getSocket() {
    if (!socketInstance) {
        socketInstance = io(SERVER_URL, {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });
    }
    return socketInstance;
}

/**
 * Primary socket hook.
 * Returns the socket instance, connection status, and a typed emit helper.
 */
export function useSocket() {
    const socket = getSocket();
    const [connected, setConnected] = useState(socket.connected);

    useEffect(() => {
        function onConnect() { setConnected(true); }
        function onDisconnect() { setConnected(false); }

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
        };
    }, [socket]);

    /**
     * Emit an event with an optional acknowledgement callback.
     * Returns a Promise that resolves with the server's ack response.
     *
     * @param {string} event
     * @param {object} payload
     * @returns {Promise<object>}
     */
    const emit = useCallback((event, payload) => {
        return new Promise((resolve) => {
            socket.emit(event, payload, (response) => {
                resolve(response);
            });
        });
    }, [socket]);

    return { socket, connected, emit };
}

/**
 * Convenience hook to subscribe to a socket event.
 * Automatically cleans up on unmount.
 *
 * @param {string} event
 * @param {function} handler
 */
export function useSocketEvent(event, handler) {
    const socket = getSocket();
    const handlerRef = useRef(handler);
    handlerRef.current = handler; // always latest without re-subscribing

    useEffect(() => {
        const fn = (...args) => handlerRef.current(...args);
        socket.on(event, fn);
        return () => socket.off(event, fn);
    }, [socket, event]);
}

export { getSocket };