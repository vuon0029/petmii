import {
  PetSpecies,
  PetColor,
  PetPersonality,
  PetLifeStage,
} from "../pet/petVariant";
import { sprites } from "../assets/pet/spriteRegistry";
import "../styles/pet-avatar.css";

interface PetAvatarProps {
  species: PetSpecies;
  color: PetColor;
  personality: PetPersonality;
  /** If true, show a static first frame instead of animating */
  static?: boolean;
  lifeStage: PetLifeStage;
}

function getSpriteSrc(
  species: string,
  color: string,
  lifeStage: PetLifeStage,
): string | undefined {
  return sprites[species]?.[color]?.[lifeStage];
}

export function PetAvatar({
  species,
  color,
  personality,
  static: isStatic,
  lifeStage,
}: PetAvatarProps) {
  const spriteSrc = getSpriteSrc(species, color, lifeStage);
  console.log("sprite src: ", spriteSrc, "life stage: ", lifeStage);

  const fallbackClass = `pet-avatar pet-species-${species} pet-color-${color} pet-personality-${personality}`;

  if (!spriteSrc) {
    return (
      <div
        className={fallbackClass}
        aria-label={`${species} pet, ${color} colored, ${personality} personality`}
      />
    );
  }

  return (
    <div
      className={`pet-avatar-container${isStatic ? " pet-avatar-static" : ""}`}
      aria-label={`${species} pet, ${color} colored, ${personality} personality`}
      style={{ backgroundImage: `url(${spriteSrc})` }}
    />
  );
}
