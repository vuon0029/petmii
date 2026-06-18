import { useState, useEffect } from "react";
import type { Egg } from "../types";
import type { PetState } from "../pet/petVariant";
import eggImage from "../assets/default_egg.png";
import "../styles/egg-list.css";

interface EggListProps {
  eggs: Egg[];
  onHatch: (eggId: string) => void;
  onDiscard: (eggId: string) => void;
  pets?: PetState[];
}

export function EggList({ eggs, onHatch, onDiscard, pets = [] }: EggListProps) {
  const [now, setNow] = useState(Date.now());
  const [incubating, setIncubating] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  function handleStartIncubation(eggId: string) {
    setIncubating(prev => new Set(prev).add(eggId));
  }

  return (
    <div className="egg-list">
      <h3 className="egg-list-title">Eggs ({eggs.length}/3)</h3>
      <div className="egg-list-items">
        {eggs.map((egg) => {
          const hatchTime = new Date(egg.hatchAt).getTime();
          const remaining = hatchTime - now;
          const isReady = remaining <= 0;
          const isIncubating = incubating.has(egg.id);

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
