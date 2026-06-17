import { PetState } from "../pet/petVariant";
import { PetAvatar } from "./PetAvatar";
import { StatBar } from "./StatBar";
import { lazy, Suspense } from "react";
import "../styles/pet-details.css";

const ResourceMonitor = lazy(() =>
  import("./ResourceMonitor").then((m) => ({ default: m.ResourceMonitor }))
);

interface PetDetailsProps {
  petState: PetState;
  onReset: () => void;
  onRename: (newName: string) => void;
  onFeed: () => void;
  onPlay: () => void;
  onClean: () => void;
  onRest: () => void;
  onOverlayMode: () => void;
}

export function PetDetails({
  petState,
  onReset,
  onRename,
  onFeed,
  onPlay,
  onClean,
  onRest,
  onOverlayMode,
}: PetDetailsProps) {
  return (
    <div className="pet-details">
      <div className="pet-details-header">
        <h1>petmii</h1>
        <p className="pet-name">{petState.name}</p>
      </div>

      <p className="pet-details-info">
        {petState.species} · {petState.color} · {petState.personality}
      </p>

      <div className="pet-details-avatar">
        <PetAvatar
          species={petState.species}
          color={petState.color}
          personality={petState.personality}
        />
      </div>

      <p className="pet-details-mood">Mood: {petState.mood}</p>

      <div className="pet-details-stats">
        <StatBar label="Hunger" value={petState.hunger} color="#ff9800" />
        <StatBar label="Happiness" value={petState.happiness} color="#ffc107" />
        <StatBar label="Energy" value={petState.energy} color="#4caf50" />
        <StatBar label="Cleanliness" value={petState.cleanliness} color="#2196f3" />
        <StatBar label="Bond" value={petState.bond} color="#e91e63" />
      </div>

      <div className="pet-details-actions">
        <button type="button" onClick={onFeed}>Feed</button>
        <button type="button" onClick={onPlay}>Play</button>
        <button type="button" onClick={onClean}>Clean</button>
        <button type="button" onClick={onRest}>Rest</button>
      </div>

      <div className="pet-details-message" aria-live="polite">
        {petState.lastMessage}
      </div>

      <Suspense fallback={null}>
        <ResourceMonitor />
      </Suspense>

      <div className="pet-details-settings">
        <button type="button" onClick={onOverlayMode} className="pet-details-overlay-btn">
          🐾 Overlay Mode
        </button>
        <button type="button" onClick={() => onRename(petState.name)}>
          Rename
        </button>
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
}
