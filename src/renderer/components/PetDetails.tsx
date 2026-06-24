import { PetState } from "../pet/petVariant";
import { PetAvatar } from "./PetAvatar";
import { StatBar } from "./StatBar";
import { getEvolutionReadiness } from "../../shared/pet/evolutionReadiness";
import { resolveVariantId } from "../overlay/variantId";
import { generatePersonalityNotes } from "../pet/personalityNotes";
import type { ActionButtonStates } from "../hooks/useCooldownState";
import type { UserActionType } from "../../shared/pet/actionTypes";
import btnLeft from "../assets/button/left.png";
import btnMid from "../assets/button/mid.png";
import btnRight from "../assets/button/right.png";
import "../styles/pet-details.css";

interface PetDetailsProps {
  petState: PetState;
  onReset: () => void;
  onRename: (newName: string) => void;
  onAction: (action: UserActionType) => void;
  onEvolve: () => void;
  buttonStates: ActionButtonStates;
  evolving?: boolean;
  isResting?: boolean;
}

function formatAge(hatchedAt: string): string {
  const ms = Date.now() - new Date(hatchedAt).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) return `${days}d ${remainingHours}h`;
  return `${hours}h`;
}

function getNextStageInfo(petState: PetState): { text: string; isReady: boolean } | null {
  if (petState.lifeStage === "adult" || petState.lifeStage === "egg") {
    return null;
  }

  const readiness = getEvolutionReadiness({
    species: petState.species,
    lifeStage: petState.lifeStage as "baby" | "child" | "adult",
    hatchedAt: Date.parse(petState.hatchedAt),
  });

  if (readiness.isReady) {
    return { text: "Ready to evolve!", isReady: true };
  }

  const h = Math.ceil(readiness.remainingHours!);
  const nextLabel = readiness.nextStage === "child" ? "Child" : "Adult";
  return { text: `${nextLabel} in ~${h}h`, isReady: false };
}

export function PetDetails({
  petState,
  onReset,
  onRename,
  onAction,
  onEvolve,
  buttonStates,
  evolving,
  isResting,
}: PetDetailsProps) {
  const canRename = petState.lifeStage === "adult";
  const nextStage = getNextStageInfo(petState);

  return (
    <div className="pet-details">
      {/* Top bar: Reset only */}
      <div className="pet-details-topbar">
        <div className="pet-details-topbar-actions">
          <button
            type="button"
            onClick={onReset}
            className="pet-details-reset-btn"
          >
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
          {petState.species} · {petState.color}
          {petState.isShiny && " ✨"} · {petState.personality}
        </p>
      </div>

      {/* Stage & age info */}
      <div className="pet-details-stage">
        <span className="pet-details-stage-badge">{petState.lifeStage}</span>
        <span className="pet-details-age">
          Age: {formatAge(petState.hatchedAt)}
        </span>
        {nextStage && (
          <span className="pet-details-next-stage">
            {nextStage.isReady ? (
              <button
                type="button"
                className="pet-details-evolve-btn"
                onClick={onEvolve}
                disabled={evolving}
              >
                {evolving ? "Evolving..." : "Evolve"}
              </button>
            ) : (
              <span className="pet-details-next-stage-countdown">{nextStage.text}</span>
            )}
          </span>
        )}
      </div>

      <div className="pet-details-avatar">
        <PetAvatar
          species={petState.species}
          variantId={resolveVariantId(petState)}
          personality={petState.personality}
          lifeStage={petState.lifeStage}
          visualState={isResting ? "sleep" : "idle"}
        />
        <div className="pet-details-speech-wrapper">
          {petState.lastMessage && petState.lastMessage !== "~" && (
            <div className="pet-details-speech">
              <span>{petState.lastMessage}</span>
            </div>
          )}
        </div>
      </div>

      <p className="pet-details-mood">{petState.mood}</p>

      <div className="pet-details-stats">
        <StatBar
          label={`HP: ${petState.hp.toFixed(2)}`}
          value={petState.hp}
          color="#e53935"
        />
        <StatBar
          label={`Hunger: ${petState.hunger.toFixed(2)}`}
          value={petState.hunger}
          color="#ff9800"
        />
        <StatBar
          label={`Happiness: ${petState.happiness.toFixed(2)}`}
          value={petState.happiness}
          color="#ffc107"
        />
        <StatBar
          label={`Energy: ${petState.energy.toFixed(2)}`}
          value={petState.energy}
          color="#4caf50"
        />
        <StatBar
          label={`Cleanliness: ${petState.cleanliness.toFixed(2)}`}
          value={petState.cleanliness}
          color="#2196f3"
        />
        <StatBar
          label={`Bond: ${petState.bond.toFixed(2)}`}
          value={petState.bond}
          color="#e91e63"
        />
      </div>

      {/* Personality Notes */}
      {petState.lifeStage !== "egg" && (
        <div className="personality-notes">
          {generatePersonalityNotes({
            name: petState.name,
            lifeStage: petState.lifeStage as "baby" | "child" | "adult",
            careHistory: petState.careHistory,
            adultTrait: petState.adultTrait,
          }).map((note, i) => (
            <p key={i} className="personality-note-line">{note}</p>
          ))}
        </div>
      )}

      <div className="pet-details-actions">
        {(['feed', 'play', 'clean', 'rest'] as const).map((action) => (
          <button
            key={action}
            type="button"
            className={`pet-action-btn ${buttonStates[action].disabled ? 'pet-action-btn-disabled' : ''}`}
            onClick={() => onAction(action)}
            disabled={buttonStates[action].disabled}
          >
            <img src={btnLeft} className="pet-action-btn-left" alt="" />
            <span className="pet-action-btn-mid" style={{ backgroundImage: `url(${btnMid})` }}>
              {buttonStates[action].label}
            </span>
            <img src={btnRight} className="pet-action-btn-right" alt="" />
          </button>
        ))}
      </div>
    </div>
  );
}
