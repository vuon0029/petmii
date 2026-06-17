import { PetSpecies, PetColor, PetPersonality } from "../pet/petVariant";
import { sprites } from "../assets/pet/spriteRegistry";
import "../styles/pet-avatar.css";

interface PetAvatarProps {
  species: PetSpecies;
  color: PetColor;
  personality: PetPersonality;
  mood?: string;
}

function getSpriteSrc(species: string, color: string, mood?: string): string | undefined {
  const sheet = mood && ["happy", "sad", "sleep"].includes(mood) ? mood : "idle";
  return sprites[species]?.[color]?.[sheet];
}

export function PetAvatar({ species, color, personality, mood }: PetAvatarProps) {
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
      className="pet-avatar-container"
      aria-label={`${species} pet, ${color} colored, ${personality} personality`}
    >
      <img
        className="pet-avatar-spritesheet pixelart"
        src={spriteSrc}
        alt={`${species} pet`}
      />
    </div>
  );
}
