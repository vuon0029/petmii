import type { PetState } from "../pet/petVariant";
import type { PhysicsState } from "../overlay/actionScheduler";
import {
  computeDayNumber,
  truncateName,
  getNamecardMilestone,
} from "../overlay/namecardUtils";

export interface PetNamecardProps {
  pet: PetState;
  isHovered: boolean;
  physicsState: PhysicsState;
}

export function PetNamecard({
  pet,
  isHovered,
  physicsState,
}: PetNamecardProps): JSX.Element | null {
  // Hidden during active physics states
  if (physicsState === "dragging" || physicsState === "flying" || physicsState === "landed") {
    return null;
  }

  // Hidden when not hovered
  if (!isHovered) {
    return null;
  }

  const truncatedName = truncateName(pet.name);
  const dayNumber = computeDayNumber(pet.hatchedAt);
  const milestone = getNamecardMilestone(dayNumber);

  const label = `${truncatedName} \u00B7 Day ${dayNumber}`;

  return (
    <div className="overlay-nametag visible" style={{ pointerEvents: "none" }}>
      <span className={`overlay-nametag-text ${milestone.className}`}>
        {milestone.adornment && <span className="overlay-namecard-adornment">{milestone.adornment} </span>}
        {label}
        {milestone.adornment && <span className="overlay-namecard-adornment"> {milestone.adornment}</span>}
      </span>
    </div>
  );
}
