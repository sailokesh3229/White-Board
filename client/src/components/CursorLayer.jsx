import { useEffect, useState } from "react";
import { socket } from "../lib/socket.js";
import { BOARD_WIDTH, BOARD_HEIGHT } from "../lib/constants.js";

const IDLE_MS = 10_000; // hide cursors that haven't moved for this long
const SWEEP_MS = 1_000;

// Other users' pointers, drawn as HTML on top of the canvas. Positions arrive
// in board units and are turned into percentages, so a cursor lands in the
// same spot on the board whatever size each person's screen is.
export default function CursorLayer() {
  const [cursors, setCursors] = useState({}); // socketId -> { name, color, x, y, lastSeen }

  useEffect(() => {
    function onMoved({ socketId, name, color, x, y }) {
      if (socketId === socket.id) return; // you already see your real pointer
      setCursors((prev) => ({ ...prev, [socketId]: { name, color, x, y, lastSeen: Date.now() } }));
    }
    function onLeft({ socketId }) {
      setCursors((prev) => {
        if (!prev[socketId]) return prev;
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    }
    // A fresh board:state (after a join or reconnect) means old cursors are stale.
    function onBoardState() {
      setCursors({});
    }

    socket.on("cursor:moved", onMoved);
    socket.on("cursor:left", onLeft);
    socket.on("board:state", onBoardState);
    return () => {
      socket.off("cursor:moved", onMoved);
      socket.off("cursor:left", onLeft);
      socket.off("board:state", onBoardState);
    };
  }, []);

  // One timer for all cursors, cleared on unmount.
  useEffect(() => {
    const timer = setInterval(() => {
      const cutoff = Date.now() - IDLE_MS;
      setCursors((prev) => {
        const active = Object.entries(prev).filter(([, cursor]) => cursor.lastSeen >= cutoff);
        return active.length === Object.keys(prev).length ? prev : Object.fromEntries(active);
      });
    }, SWEEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="cursor-layer" aria-hidden="true">
      {Object.entries(cursors).map(([socketId, { name, color, x, y }]) => (
        <div
          key={socketId}
          className="remote-cursor"
          style={{ left: `${(x / BOARD_WIDTH) * 100}%`, top: `${(y / BOARD_HEIGHT) * 100}%` }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path d="M1 1 L1 15 L5 11 L8 17 L10.5 16 L7.5 10 L13 10 Z" fill={color} stroke="#fff" strokeWidth="1.2" />
          </svg>
          <span className="remote-cursor-label" style={{ background: color }}>
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}
