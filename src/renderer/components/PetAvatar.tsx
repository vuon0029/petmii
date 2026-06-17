import { PetSpecies, PetColor, PetPersonality } from "../pet/petVariant";
import { sprites } from "../assets/pet/spriteRegistry";
import "../styles/pet-avatar.css";

interface PetAvatarProps {
  species: PetSpecies;
  color: PetColor;
  personality: PetPersonality;
  mood?: string;
  /** If true, show a static first frame instead of animating */
  static?: boolean;
}

function getSpriteSrc(species: string, color: string, mood?: string): string | undefined {
  const sheet = mood && ["happy", "sad", "sleep"].includes(mood) ? mood : "idle";
  return sprites[species]?.[color]?.[sheet];
}

export function PetAvatar({ species, color, personality, mood, static: isStatic }: PetAvatarProps) {
  const spriteSrc = getSpriteSrc(species, color, mood);

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
