import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";
import { BOARD_ID_REGEX } from "../lib/constants.js";
import { extractBoardId } from "../lib/boardLink.js";

export default function Home() {
  const navigate = useNavigate();
  const [joinInput, setJoinInput] = useState("");
  const [error, setError] = useState("");

  function handleCreate() {
    navigate(`/board/${nanoid(10)}`);
  }

  function handleJoin(event) {
    event.preventDefault();
    const boardId = extractBoardId(joinInput);
    if (!BOARD_ID_REGEX.test(boardId)) {
      setError("That doesn't look like a board link or ID.");
      return;
    }
    navigate(`/board/${boardId}`);
  }

  return (
    <main className="home">
      <h1>Whiteboard</h1>
      <p className="home-intro">Draw together in real time. Share the link to invite others.</p>

      <button type="button" className="primary-button" onClick={handleCreate}>
        Create new board
      </button>

      <form className="join-form" onSubmit={handleJoin} noValidate>
        <label htmlFor="join-input">Join a board</label>
        <div className="join-row">
          <input
            id="join-input"
            type="text"
            placeholder="Paste a board link or ID"
            value={joinInput}
            onChange={(e) => {
              setJoinInput(e.target.value);
              setError("");
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "join-error" : undefined}
          />
          <button type="submit">Join board</button>
        </div>
        {error && (
          <p id="join-error" className="form-error">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
