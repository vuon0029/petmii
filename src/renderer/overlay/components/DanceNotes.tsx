// src/renderer/overlay/components/DanceNotes.tsx
// Stateless React component — renders floating music note emojis around a dancing pet.
// No side effects beyond rendering. pointer-events: none so it doesn't block drag/interactions.

import { useState, useEffect, useRef } from "react";

const NOTE_EMOJIS = ["♪", "♫", "♬", "🎵", "🎶"];
const MAX_NOTES = 3;
const NOTE_LIFETIME_MIN_MS = 1500;
const NOTE_LIFETIME_MAX_MS = 2500;
const SPAWN_INTERVAL_MS = 800;
const NOTE_SPREAD_PX = 40;

interface NoteState {
  id: number;
  emoji: string;
  offsetX: number;
  offsetY: number;
  lifetimeMs: number;
  startedAt: number;
}

export interface DanceNotesProps {
  petX: number;
  petY: number;
  petSize: number;
  isActive: boolean;
}

export function DanceNotes({ petX, petY, petSize, isActive }: DanceNotesProps): JSX.Element | null {
  const [notes, setNotes] = useState<NoteState[]>([]);
  const nextIdRef = useRef(0);
  const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isActive) {
      setNotes([]);
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
        spawnTimerRef.current = null;
      }
      return;
    }

    // Spawn notes periodically
    function spawnNote() {
      const id = nextIdRef.current++;
      const emoji = NOTE_EMOJIS[Math.floor(Math.random() * NOTE_EMOJIS.length)];
      const offsetX = (Math.random() - 0.5) * NOTE_SPREAD_PX * 2;
      const offsetY = -(Math.random() * NOTE_SPREAD_PX);
      const lifetimeMs =
        NOTE_LIFETIME_MIN_MS + Math.random() * (NOTE_LIFETIME_MAX_MS - NOTE_LIFETIME_MIN_MS);

      setNotes((prev) => {
        // Limit concurrent notes
        const active = prev.length < MAX_NOTES ? prev : prev.slice(1);
        return [...active, { id, emoji, offsetX, offsetY, lifetimeMs, startedAt: Date.now() }];
      });

      // Remove note after its lifetime
      setTimeout(() => {
        setNotes((prev) => prev.filter((n) => n.id !== id));
      }, lifetimeMs);
    }

    // Spawn first note immediately
    spawnNote();

    spawnTimerRef.current = setInterval(spawnNote, SPAWN_INTERVAL_MS);

    return () => {
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
        spawnTimerRef.current = null;
      }
    };
  }, [isActive]);

  if (!isActive || notes.length === 0) return null;

  const centerX = petSize / 2;
  const topY = 5; // slightly overlapping the pet top area

  return (
    <div
      className="dance-notes-container"
      style={{ pointerEvents: "none", position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible" }}
    >
      {notes.map((note) => {
        const elapsed = Date.now() - note.startedAt;
        const progress = Math.min(elapsed / note.lifetimeMs, 1);
        const opacity = 1 - progress;
        const floatY = -progress * 25; // float upward

        return (
          <span
            key={note.id}
            className="dance-note"
            style={{
              position: "absolute",
              left: `${centerX + note.offsetX}px`,
              top: `${topY + note.offsetY + floatY}px`,
              opacity,
              fontSize: "18px",
              pointerEvents: "none",
              textShadow: "0 0 4px rgba(255,255,255,0.9), 0 0 8px rgba(255,200,255,0.7), 1px 1px 0 rgba(0,0,0,0.3)",
              filter: "drop-shadow(0 0 2px white)",
              animation: `dance-note-float ${note.lifetimeMs}ms ease-out forwards`,
            }}
          >
            {note.emoji}
          </span>
        );
      })}
    </div>
  );
}
