import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "../config/api.config";

// One socket per tab, authenticated with the stored JWT. The server puts
// it in the user's room and pushes message:new and message:status.
let socket = null;

export function connectRealtime() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  if (socket && socket.auth?.token === token) return socket;
  socket?.disconnect();

  socket = io(SERVER_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  return socket;
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
}

/**
 * Subscribe to a realtime event for the lifetime of a component.
 * The handler can change between renders without resubscribing.
 */
export function useRealtime(event, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const client = connectRealtime();
    if (!client) return undefined;
    const listener = (payload) => handlerRef.current(payload);
    client.on(event, listener);
    return () => client.off(event, listener);
  }, [event]);
}
