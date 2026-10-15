import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Canvas from "../components/Canvas.jsx";
import Toolbar from "../components/Toolbar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { socket } from "../lib/socket.js";

const TOAST_MS = 3000;

export default function Board() {
  const { boardId } = useParams();
  // UI state lives here so both the Toolbar (which changes it) and the
  // Canvas (which uses it for new strokes) see the same values.
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#1e1e1e");
  const [size, setSize] = useState(4);
  const [toast, setToast] = useState(null);
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

  // Hide the toast after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  function handleElementCreated(element) {
    socket.emit("element:add", { element });
  }

  function handleClear() {
    if (!window.confirm("Clear the whole board?")) return;
    canvasRef.current.clear();
    socket.emit("board:clear");
  }

  return (
    <main className="board-page">
      <header className="board-header">
        <span className="board-id">Board: {boardId}</span>
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
