import { PetState } from "../pet/petVariant";
import { PetAvatar } from "./PetAvatar";
import { StatBar } from "./StatBar";
import { lazy, Suspense } from "react";
import { SPECIES_TRAITS } from "../pet/speciesTraits";
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

function formatAge(hatchedAt: string): string {
  const ms = Date.now() - new Date(hatchedAt).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) return `${days}d ${remainingHours}h`;
  return `${hours}h`;
}

function getNextStageInfo(petState: PetState): string | null {
  const traits = SPECIES_TRAITS[petState.species];
  const ageMs = Date.now() - new Date(petState.hatchedAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (petState.lifeStage === "baby") {
    const remaining = traits.stages.babyToChild - ageHours;
    if (remaining <= 0) return "Ready to evolve!";
    const h = Math.ceil(remaining);
    return `Child in ~${h}h`;
  }

  if (petState.lifeStage === "child") {
    const totalToAdult = traits.stages.babyToChild + traits.stages.childToAdult;
    const remaining = totalToAdult - ageHours;
    if (remaining <= 0) return "Ready to evolve!";
    const h = Math.ceil(remaining);
    return `Adult in ~${h}h`;
  }

  return null; // Adult — no next stage to show
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
  const canRename = petState.lifeStage === "adult";
  const nextStage = getNextStageInfo(petState);

  return (
    <div className="pet-details">
      {/* Top bar */}
      <div className="pet-details-topbar">
        <Suspense fallback={null}>
          <ResourceMonitor />
        </Suspense>
        <div className="pet-details-topbar-actions">
          <button type="button" onClick={onOverlayMode} className="pet-details-overlay-btn">
            🐾 Overlay
          </button>
          <button type="button" onClick={onReset} className="pet-details-reset-btn">
            ↺
          </button>
        </div>
      </div>

      {/* Pet name with pencil for rename */}
      <div className="pet-details-header">
        <div className="pet-details-name-row">
          <p className="pet-name">{petState.name}</p>
          {canRename && (
            <button
              type="button"
              className="pet-details-rename-icon"
              onClick={() => onRename(petState.name)}
              title="Rename your pet"
            >
              ✏️
            </button>
          )}
        </div>
        <p className="pet-details-info">
          {petState.species} · {petState.color} · {petState.personality}
          {petState.isShiny && " ✨"}
        </p>
      </div>

      {/* Stage & age info */}
      <div className="pet-details-stage">
        <span className="pet-details-stage-badge">{petState.lifeStage}</span>
        <span className="pet-details-age">Age: {formatAge(petState.hatchedAt)}</span>
        {nextStage && <span className="pet-details-next-stage">{nextStage}</span>}
      </div>

      <div className="pet-details-avatar">
        <PetAvatar
          species={petState.species}
          color={petState.color}
          personality={petState.personality}
        />
      </div>

      <p className="pet-details-mood">{petState.mood}</p>

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
    </div>
  );
}
