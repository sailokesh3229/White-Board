import { Link } from "react-router-dom";

// Placeholder until Phase 6 adds "Create new board" and "Join board".
export default function Home() {
  return (
    <main className="app">
      <h1>Whiteboard</h1>
      <p>
        <Link to="/board/test123">Open test board</Link>
      </p>
    </main>
  );
}
