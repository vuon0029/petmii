import { resolveSprite } from "../assets/pet/fallbackResolver";
import { spriteRegistry } from "../assets/pet/spriteRegistry";
import "../styles/pet-avatar.css";

export interface PetAvatarProps {
  species: string;
  variantId: string;
  lifeStage: string;
  visualState: "idle" | "sleep";
  personality: string;
  static?: boolean;
}

/**
 * PetAvatar — stateless sprite renderer.
 * Receives read-only presentation props, resolves the sprite asset via
 * the fallback chain, and applies sprite metadata to CSS animation.
 * Falls back to a CSS-based avatar when no sprite is found.
 *
 * This component has NO awareness of position, movement, or physics state.
 */
export function PetAvatar({
  species,
  variantId,
  lifeStage,
  visualState,
  personality,
  static: isStatic,
}: PetAvatarProps) {
  const resolved = resolveSprite(
    species,
    variantId,
    lifeStage,
    visualState,
    spriteRegistry,
  );

  // CSS fallback avatar when no sprite asset is found
  if (!resolved) {
    const fallbackClass = `pet-avatar pet-species-${species} pet-color-${variantId} pet-personality-${personality}`;
    return (
      <div
        className={fallbackClass}
        aria-label={`${species} pet, ${variantId} colored, ${personality} personality`}
      />
    );
  }

  const { src, metadata } = resolved;
  const { frameSize, frameCount, durationMs, loop } = metadata;

  // Compute dynamic CSS animation values from sprite metadata
  const backgroundWidth = frameSize * frameCount;

  const containerStyle: React.CSSProperties & Record<string, string | number | undefined> = {
    width: `${frameSize}px`,
    height: `${frameSize}px`,
    backgroundImage: `url(${src})`,
    backgroundSize: `${backgroundWidth}px ${frameSize}px`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "0 0",
    // CSS custom property for the keyframe end position
    "--sprite-end-pos": `-${backgroundWidth}px`,
  };

  // Apply animation unless static mode
  if (!isStatic) {
    containerStyle.animation = `moveSpritesheet ${durationMs}ms steps(${frameCount}) ${loop ? "infinite" : "1"}`;
    if (!loop) {
      containerStyle.animationFillMode = "forwards";
    }
  }

  return (
    <div
      className={`pet-avatar-container${isStatic ? " pet-avatar-static" : ""}`}
      aria-label={`${species} pet, ${variantId} colored, ${personality} personality`}
      style={containerStyle}
    />
  );
}
