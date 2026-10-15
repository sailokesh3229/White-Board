import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Canvas from "../components/Canvas.jsx";
import Toolbar from "../components/Toolbar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { socket } from "../lib/socket.js";
import { BOARD_ID_REGEX } from "../lib/constants.js";

const TOAST_MS = 3000;

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
  const canvasRef = useRef(null);

  // Connect while the board page is open. In development, React Strict Mode
  // runs this effect twice (mount, cleanup, mount), so the cleanup must really
  // disconnect, or each tab would leave an extra connection open.
  useEffect(() => {
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, []);

  // Join the board on EVERY connect, not just the first one. After a
  // reconnect the server sees a brand-new socket that isn't in any room yet.
  // Also re-runs when boardId changes, so moving between boards in the same
  // tab leaves the old room and joins the new one.
  useEffect(() => {
    canvasRef.current?.clear(); // don't show the previous board's drawing
    function join() {
      socket.emit("board:join", { boardId });
    }
    if (socket.connected) join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
    };
  }, [boardId]);

  // Changes from other users. Every socket.on has a matching socket.off,
  // otherwise a remount would register a second handler and draw everything twice.
  useEffect(() => {
    function onElementAdded({ element }) {
      canvasRef.current?.addRemoteElement(element);
    }
    function onBoardCleared() {
      canvasRef.current?.clear();
      setToast("Board was cleared");
    }
    socket.on("element:added", onElementAdded);
    socket.on("board:cleared", onBoardCleared);
    return () => {
      socket.off("element:added", onElementAdded);
      socket.off("board:cleared", onBoardCleared);
    };
  }, []);

  // The full board, sent to us after every (re)join. It REPLACES what we have,
  // so a reconnect never shows elements twice.
  useEffect(() => {
    function onBoardState({ elements }) {
      canvasRef.current?.replaceAll(elements);
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

  function handleElementCreated(element) {
    socket.emit("element:add", { element });
  }

  function handleClear() {
    if (!window.confirm("Clear the whole board?")) return;
    canvasRef.current.clear();
    socket.emit("board:clear");
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
      <Canvas
        ref={canvasRef}
        tool={tool}
        color={color}
        size={size}
        disabled={loading}
        onElementCreated={handleElementCreated}
      />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
