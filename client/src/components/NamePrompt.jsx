import { useState } from "react";
import { MAX_NAME_LENGTH } from "../lib/constants.js";
import { cleanName } from "../lib/user.js";

// Asks for a display name. Shown before joining when no name is saved, and
// again when you click your own name to rename (then it can be cancelled).
export default function NamePrompt({ initialName = "", onSubmit, onCancel }) {
  const [name, setNameValue] = useState(initialName);
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const cleaned = cleanName(name);
    if (!cleaned) {
      setError("Please enter a name.");
      return;
    }
    onSubmit(cleaned);
  }

  return (
    <div className="modal-backdrop">
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="name-title" onSubmit={handleSubmit}>
        <h2 id="name-title">What's your name?</h2>
        <p className="modal-hint">Others on the board will see it next to your cursor.</p>
        <input
          type="text"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          autoFocus
          aria-label="Your name"
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            setNameValue(e.target.value);
            setError("");
          }}
        />
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="primary-button">
            {onCancel ? "Save" : "Join board"}
          </button>
        </div>
      </form>
    </div>
  );
}
