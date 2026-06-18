// src/renderer/components/EggInventory.tsx
// Shows current eggs with hatch progress and allows hatching when ready.

import { useState, useEffect } from "react";
import type { Egg } from "../types";
import "../styles/egg-inventory.css";

interface EggInventoryProps {
  eggs: Egg[];
  onHatch: (eggId: string) => void;
}

export function EggInventory({ eggs, onHatch }: EggInventoryProps) {
  const [now, setNow] = useState(Date.now());

  // Update progress every second
  useEffect(() => {
    if (eggs.length === 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [eggs.length]);

  if (eggs.length === 0) return null;

  return (
    <div className="egg-inventory">
      <h3 className="egg-inventory-title">🥚 Eggs</h3>
      <div className="egg-inventory-list">
        {eggs.map((egg) => {
          const foundTime = new Date(egg.foundAt).getTime();
          const hatchTime = new Date(egg.hatchAt).getTime();
          const totalDuration = hatchTime - foundTime;
          const elapsed = now - foundTime;
          const progress = Math.min(elapsed / totalDuration, 1);
          const isReady = progress >= 1;
          const remaining = Math.max(0, hatchTime - now);

          return (
            <div key={egg.id} className={`egg-card ${isReady ? "egg-card-ready" : ""}`}>
              <div className="egg-card-icon">
                {egg.isShiny ? "✨🥚" : "🥚"}
              </div>
              <div className="egg-card-info">
                <span className="egg-card-species">{egg.species}</span>
                {isReady ? (
                  <button
                    type="button"
                    className="egg-card-hatch-btn"
                    onClick={() => onHatch(egg.id)}
                  >
                    Hatch!
                  </button>
                ) : (
                  <div className="egg-card-progress">
                    <div
                      className="egg-card-progress-bar"
                      style={{ width: `${progress * 100}%` }}
                    />
                    <span className="egg-card-time">
                      {formatRemaining(remaining)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {eggs.length < 3 && (
        <p className="egg-inventory-hint">
          Healthy adult pets may find eggs~
        </p>
      )}
    </div>
  );
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
