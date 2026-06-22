import { useState, useEffect, useRef } from "react";
import type { Egg, GameState } from "../types";
import type { PetState } from "../pet/petVariant";
import eggImage from "../assets/default_egg.png";
import "../styles/egg-list.css";

// Replicated from petStorage.ts (main process only) — keep in sync
const EGG_HATCH_HOURS: Record<string, number> = {
  blob: 0.5,
  frog: 0.7,
};

interface EggListProps {
  eggs: Egg[];
  onHatch: (eggId: string) => void;
  onDiscard: (eggId: string) => void;
  pets?: PetState[];
  onGameUpdate?: (game: GameState) => void;
}

/**
 * Normalize egg statuses based on wall-clock time.
 * If an egg is "incubating" and the current time is past hatchesAt, treat it as "readyToHatch".
 */
function normalizeEggs(eggs: Egg[]): Egg[] {
  const now = Date.now();
  return eggs.map((egg) => {
    if (egg.status === "incubating" && egg.hatchesAt) {
      if (now >= new Date(egg.hatchesAt).getTime()) {
        return { ...egg, status: "readyToHatch" as const };
      }
    }
    return egg;
  });
}

export function EggList({ eggs, onHatch, onDiscard, pets = [], onGameUpdate }: EggListProps) {
  const [now, setNow] = useState(Date.now());
  const [normalizedEggs, setNormalizedEggs] = useState<Egg[]>(() => normalizeEggs(eggs));
  const prevEggsRef = useRef(eggs);

  // Normalize eggs on mount and when eggs prop changes
  useEffect(() => {
    setNormalizedEggs(normalizeEggs(eggs));
    prevEggsRef.current = eggs;
  }, [eggs]);

  // UI countdown timer — refreshes display only, not source of truth
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      // Re-normalize in case any eggs have elapsed during the interval
      setNormalizedEggs(normalizeEggs(prevEggsRef.current));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleStartIncubation(eggId: string) {
    const egg = eggs.find((e) => e.id === eggId);
    if (!egg) return;

    const hours = EGG_HATCH_HOURS[egg.species] ?? 0.5;
    const durationMs = hours * 60 * 60 * 1000;
    const incubationStartedAt = new Date().toISOString();
    const hatchesAt = new Date(Date.now() + durationMs).toISOString();

    // Load current game state, update the egg, and save
    const game = await window.petmiiAPI.loadGame();
    const updatedEggs = game.eggs.map((e) =>
      e.id === eggId
        ? {
            ...e,
            status: "incubating" as const,
            incubationStartedAt,
            incubationDurationMs: durationMs,
            hatchesAt,
          }
        : e,
    );

    const updatedGame: GameState = { ...game, eggs: updatedEggs };
    await window.petmiiAPI.saveGame(updatedGame);

    // Update local normalized view immediately
    setNormalizedEggs(normalizeEggs(updatedEggs));

    // Notify parent so it can refresh its game state
    if (onGameUpdate) {
      onGameUpdate(updatedGame);
    }
  }

  return (
    <div className="egg-list">
      <h3 className="egg-list-title">Eggs ({normalizedEggs.length}/3)</h3>
      <div className="egg-list-items">
        {normalizedEggs.map((egg) => {
          const isReady = egg.status === "readyToHatch";
          const isIncubating = egg.status === "incubating";

          // Compute remaining time from persisted hatchesAt
          const remaining = isIncubating && egg.hatchesAt
            ? new Date(egg.hatchesAt).getTime() - now
            : 0;

          return (
            <div key={egg.id} className={`egg-item ${isReady ? "egg-item-ready" : ""}`}>
              <img src={eggImage} alt={`${egg.species} egg`} className="egg-item-img" />
              <div className="egg-item-info">
                <span className="egg-item-species">{egg.species}</span>
                {egg.isShiny && <span className="egg-item-shiny">✨</span>}
                <span className="egg-item-found-by">
                  Found by: {egg.foundBy === "mercy" ? "Mercy" : (pets.find(p => p.id === egg.foundBy)?.name || "Unknown")}
                </span>
                {isReady ? (
                  <span className="egg-item-status">Ready!</span>
                ) : isIncubating ? (
                  <span className="egg-item-timer">{formatTime(remaining)}</span>
                ) : (
                  <span className="egg-item-status egg-item-waiting">Found!</span>
                )}
              </div>
              <div className="egg-item-actions">
                {isReady && (
                  <button type="button" className="egg-item-hatch-btn" onClick={() => onHatch(egg.id)}>
                    Hatch
                  </button>
                )}
                {!isReady && !isIncubating && (
                  <button type="button" className="egg-item-incubate-btn" onClick={() => handleStartIncubation(egg.id)}>
                    Incubate
                  </button>
                )}
                <button type="button" className="egg-item-discard-btn" onClick={() => onDiscard(egg.id)}>
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  if (ms <= 0) return "Ready!";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
