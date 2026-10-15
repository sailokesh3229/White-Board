import { useEffect, useState } from "react";
import { socket } from "../lib/socket.js";

export default function StatusBadge() {
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    // Remove exactly these handlers; otherwise every remount adds another copy.
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return (
    <span className={`status-badge ${connected ? "online" : "offline"}`} role="status">
      {connected ? "Connected" : "Disconnected — reconnecting…"}
    </span>
  );
}
