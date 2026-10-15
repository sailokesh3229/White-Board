import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Canvas from "../components/Canvas.jsx";
import Toolbar from "../components/Toolbar.jsx";

export default function Board() {
  const { boardId } = useParams();
  // UI state lives here so both the Toolbar (which changes it) and the
  // Canvas (which uses it for new strokes) see the same values.
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#1e1e1e");
  const [size, setSize] = useState(4);
  const canvasRef = useRef(null);

  function handleClear() {
    if (window.confirm("Clear the whole board?")) canvasRef.current.clear();
  }

  return (
    <main className="board-page">
      <p className="board-id">Board: {boardId}</p>
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
