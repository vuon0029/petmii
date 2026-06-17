import { useState } from "react";
import "../styles/rename-modal.css";

interface RenamePetModalProps {
  currentName: string;
  onRename: (newName: string) => void;
  onClose: () => void;
}

export function RenamePetModal({ currentName, onRename, onClose }: RenamePetModalProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = name.trim();

    if (trimmed.length === 0) {
      setError("A non-empty name is required");
      return;
    }

    if (trimmed.length > 20) {
      setError("Name must be 20 characters or fewer");
      return;
    }

    setError("");
    onRename(trimmed);
  }

  return (
    <div className="rename-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Rename pet">
      <div className="rename-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Rename Pet</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            maxLength={20}
            placeholder="Name your pet"
            autoFocus
            aria-label="Pet name"
            aria-describedby={error ? "rename-error" : undefined}
          />
          {error && (
            <p id="rename-error" className="rename-modal__error" role="alert">
              {error}
            </p>
          )}
          <div className="rename-modal__actions">
            <button type="button" className="rename-modal__cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="rename-modal__confirm">
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
