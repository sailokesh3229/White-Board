import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Canvas from "../components/Canvas.jsx";
import Toolbar from "../components/Toolbar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import OnlineUsers from "../components/OnlineUsers.jsx";
import NamePrompt from "../components/NamePrompt.jsx";
import CursorLayer from "../components/CursorLayer.jsx";
import { throttle } from "../lib/throttle.js";
import { socket } from "../lib/socket.js";
import { BOARD_ID_REGEX, CURSOR_THROTTLE_MS } from "../lib/constants.js";
import { getUser, setName } from "../lib/user.js";

const TOAST_MS = 3000;
const SHORTCUTS = { p: "pen", e: "eraser", r: "rect", c: "circle", l: "line" };

export default function Board() {
  const { boardId } = useParams();
  // Catch obviously bad IDs (like "a!") before connecting at all.
  // The server checks again, because the client is never trusted.
  if (!BOARD_ID_REGEX.test(boardId)) return <InvalidBoard />;
  return <BoardView boardId={boardId} />;
}

function InvalidBoard() {
  return (
    <main className="message-page">
      <h1>Invalid board</h1>
      <p>This board link isn't valid. Check the link, or start a new board.</p>
      <Link to="/">Go to the home page</Link>
    </main>
  );
}

function sendAction(action) {
  if (action.kind === "add") socket.emit("element:add", { element: action.element });
  else socket.emit("board:clear");
}

function BoardView({ boardId }) {
  // UI state lives here so both the Toolbar (which changes it) and the
  // Canvas (which uses it for new strokes) see the same values.
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#1e1e1e");
  const [size, setSize] = useState(4);
  const [toast, setToast] = useState(null);
  const [rejectedBoardId, setRejectedBoardId] = useState(null);
  // Drawing stays disabled until this board's first board:state arrives;
  // otherwise a stroke drawn during loading would be wiped by the redraw.
  const [loadedBoardId, setLoadedBoardId] = useState(null);
  const loading = loadedBoardId !== boardId;
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState(getUser);
  const [renaming, setRenaming] = useState(false);
  const [users, setUsers] = useState([]);
  const canvasRef = useRef(null);

  // Outbox: changes we made while we couldn't safely send them (offline, or
  // reconnected but not yet re-joined). Socket.IO's own buffer isn't enough:
  // it flushes BEFORE our "connect" handler re-joins the board, so the server
  // would see drawings from a socket that isn't on any board and drop them.
  // So we hold them here and send them after board:state confirms the join.
  const outboxRef = useRef([]); // [{ kind: "add", element } | { kind: "clear" }]
  const syncedRef = useRef(false); // has this connection received board:state?

  // Pointer moves fire hundreds of times per second; throttling keeps cursor
  // traffic to ~20 messages per second (one per CURSOR_THROTTLE_MS).
  const sendCursor = useMemo(
    // volatile: if we're offline, drop the position instead of queueing it.
    () => throttle((x, y) => socket.volatile.emit("cursor:move", { x, y }), CURSOR_THROTTLE_MS),
    [],
  );
  useEffect(() => () => sendCursor.cancel(), [sendCursor]);

  // Connect while the board page is open. In development, React Strict Mode
  // runs this effect twice (mount, cleanup, mount), so the cleanup must really
  // disconnect, or each tab would leave an extra connection open.
  useEffect(() => {
    socket.connect();
    // Leaving the page (closing the tab, navigating away, or the browser
    // freezing it in its back/forward cache) should take us off the board
    // right away, not ~45 s later when the server's heartbeat times out.
    function onPageHide() {
      socket.disconnect();
    }
    function onPageShow(event) {
      if (event.persisted) socket.connect(); // restored from the back/forward cache
    }
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      socket.disconnect();
    };
  }, []);

  // Don't show the previous board's drawing while the next one loads, and
  // never send the previous board's unsent drawings to the new one.
  useEffect(() => {
    canvasRef.current?.clear();
    outboxRef.current = [];
    syncedRef.current = false;
  }, [boardId]);

  useEffect(() => {
    function onDisconnect() {
      syncedRef.current = false;
    }
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // Keyboard shortcuts. Ignored while typing (name prompt, inputs) and when a
  // modifier is held, so Ctrl+C still copies instead of picking the circle.
  useEffect(() => {
    function onKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target.closest?.("input, textarea, select, [contenteditable='true'], .modal")) return;
      const shortcut = SHORTCUTS[event.key.toLowerCase()];
      if (shortcut) setTool(shortcut);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Join the board on EVERY connect, not just the first one. After a
  // reconnect the server sees a brand-new socket that isn't in any room yet.
  // Also re-runs when boardId changes (leave the old room, join the new one)
  // and when the user renames (the server updates the online list).
  // We wait until we have a name, so the server never lists a nameless user.
  useEffect(() => {
    if (!user.name) return;
    function join() {
      socket.emit("board:join", { boardId, user });
    }
    if (socket.connected) join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
    };
  }, [boardId, user]);

  // Changes from other users. Every socket.on has a matching socket.off,
  // otherwise a remount would register a second handler and draw everything twice.
  useEffect(() => {
    function onElementAdded({ element }) {
      canvasRef.current?.addElement(element); // skips duplicates by id
    }
    function onBoardCleared({ by }) {
      canvasRef.current?.clear();
      setToast(`Board cleared by ${by}`);
    }
    function onPresenceUpdate({ users }) {
      setUsers(users);
    }
    socket.on("element:added", onElementAdded);
    socket.on("board:cleared", onBoardCleared);
    socket.on("presence:update", onPresenceUpdate);
    return () => {
      socket.off("element:added", onElementAdded);
      socket.off("board:cleared", onBoardCleared);
      socket.off("presence:update", onPresenceUpdate);
    };
  }, []);

  // The full board, sent to us after every (re)join. It REPLACES what we have,
  // so a reconnect never shows elements twice.
  useEffect(() => {
    function onBoardState({ elements }) {
      const canvas = canvasRef.current;
      canvas?.replaceAll(elements);
      // We're on the board again: replay what we did while offline, in order.
      const pending = outboxRef.current;
      outboxRef.current = [];
      syncedRef.current = true;
      for (const action of pending) {
        if (action.kind === "clear") canvas?.clear();
        // addElement returns false if the server already had it: don't resend.
        else if (canvas && !canvas.addElement(action.element)) continue;
        sendAction(action);
      }
      setLoadedBoardId(boardId);
    }
    socket.on("board:state", onBoardState);
    return () => {
      socket.off("board:state", onBoardState);
    };
  }, [boardId]);

  useEffect(() => {
    function onErrorMessage({ message }) {
      if (message === "Invalid board ID") setRejectedBoardId(boardId);
      else setToast(message);
    }
    socket.on("error:message", onErrorMessage);
    return () => {
      socket.off("error:message", onErrorMessage);
    };
  }, [boardId]);

  // Hide the toast after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  function sendOrQueue(action) {
    if (syncedRef.current && socket.connected) sendAction(action);
    else outboxRef.current.push(action);
  }

  function handleElementCreated(element) {
    sendOrQueue({ kind: "add", element });
  }

  function handleClear() {
    if (!window.confirm("Clear the whole board?")) return;
    canvasRef.current.clear();
    sendOrQueue({ kind: "clear" });
  }

  function handleCursorLeave() {
    sendCursor.cancel(); // a late trailing "move" would bring the cursor back
    socket.volatile.emit("cursor:leave");
  }

  function handleNameSubmit(name) {
    setUser(setName(name));
    setRenaming(false);
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setToast("Could not copy the link. Copy it from the address bar instead.");
    }
  }

  if (rejectedBoardId === boardId) return <InvalidBoard />;

  return (
    <main className="board-page">
      <header className="board-header">
        <Link to="/" className="home-link">
          ← Home
        </Link>
        <span className="board-id" title="Board ID">
          Board: {boardId}
        </span>
        <button type="button" className="copy-button" onClick={handleCopyLink}>
          {copied ? "Link copied!" : "Copy link"}
        </button>
        <StatusBadge />
      </header>
      <Toolbar
        tool={tool}
        color={color}
        size={size}
        onToolChange={setTool}
        onColorChange={setColor}
        onSizeChange={setSize}
        onClear={handleClear}
      />
      <div className="board-layout">
        <Canvas
          ref={canvasRef}
          tool={tool}
          color={color}
          size={size}
          userId={user.userId}
          disabled={loading}
          onElementCreated={handleElementCreated}
          onCursorMove={sendCursor}
          onCursorLeave={handleCursorLeave}
        >
          <CursorLayer />
        </Canvas>
        <OnlineUsers users={users} selfId={socket.id} onRename={() => setRenaming(true)} />
      </div>
      {!user.name && <NamePrompt onSubmit={handleNameSubmit} />}
      {user.name && renaming && (
        <NamePrompt initialName={user.name} onSubmit={handleNameSubmit} onCancel={() => setRenaming(false)} />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
