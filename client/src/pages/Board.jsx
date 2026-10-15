import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Canvas from "../components/Canvas.jsx";
import Toolbar from "../components/Toolbar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { socket } from "../lib/socket.js";

export default function Board() {
  const { boardId } = useParams();
  // UI state lives here so both the Toolbar (which changes it) and the
  // Canvas (which uses it for new strokes) see the same values.
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#1e1e1e");
  const [size, setSize] = useState(4);
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

  function handleClear() {
    if (window.confirm("Clear the whole board?")) canvasRef.current.clear();
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
      <Canvas ref={canvasRef} tool={tool} color={color} size={size} />
    </main>
  );
}
