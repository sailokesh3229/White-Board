import { useParams } from "react-router-dom";
import Canvas from "../components/Canvas.jsx";

export default function Board() {
  const { boardId } = useParams();

  return (
    <main className="board-page">
      <p className="board-id">Board: {boardId}</p>
      <Canvas />
    </main>
  );
}
