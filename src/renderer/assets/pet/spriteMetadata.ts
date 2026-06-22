/**
 * Sprite metadata types and resolution.
 * Defines frame size, frame count, animation duration, and loop configuration
 * for sprite sheets, with per-sprite overrides and validation/clamping.
 */

export interface SpriteMetadata {
  frameSize: number; // px per frame side, range 16–256
  frameCount: number; // number of frames, range 1–60
  durationMs: number; // total animation cycle duration in ms, range 100–10000
  loop: boolean; // whether the animation loops
}

export const DEFAULT_SPRITE_METADATA: SpriteMetadata = {
  frameSize: 48,
  frameCount: 5,
  durationMs: 1300,
  loop: true,
};

// Metadata range constraints
const FRAME_SIZE_MIN = 16;
const FRAME_SIZE_MAX = 256;
const FRAME_COUNT_MIN = 1;
const FRAME_COUNT_MAX = 60;
const DURATION_MS_MIN = 100;
const DURATION_MS_MAX = 10000;

/**
 * Clamps a numeric value to the given range [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Validates and clamps a partial sprite metadata object, filling in defaults
 * for any missing fields and ensuring all values are within valid ranges.
 */
export function validateSpriteMetadata(
  partial: Partial<SpriteMetadata>
): SpriteMetadata {
  const frameSize = clamp(
    typeof partial.frameSize === "number" ? partial.frameSize : DEFAULT_SPRITE_METADATA.frameSize,
    FRAME_SIZE_MIN,
    FRAME_SIZE_MAX
  );
  const frameCount = clamp(
    typeof partial.frameCount === "number" ? partial.frameCount : DEFAULT_SPRITE_METADATA.frameCount,
    FRAME_COUNT_MIN,
    FRAME_COUNT_MAX
  );
  const durationMs = clamp(
    typeof partial.durationMs === "number" ? partial.durationMs : DEFAULT_SPRITE_METADATA.durationMs,
    DURATION_MS_MIN,
    DURATION_MS_MAX
  );
  const loop =
    typeof partial.loop === "boolean" ? partial.loop : DEFAULT_SPRITE_METADATA.loop;

  return { frameSize, frameCount, durationMs, loop };
}

/**
 * Internal registry for per-sprite metadata overrides.
 * Keyed by: `${species}/${variantId}/${lifeStage}/${visualState}`
 */
const spriteMetadataRegistry: Record<string, Partial<SpriteMetadata>> = {};

/**
 * Registers sprite metadata for a specific sprite key.
 * Used to populate overrides at module load or from config.
 */
export function registerSpriteMetadata(
  species: string,
  variantId: string,
  lifeStage: string,
  visualState: "idle" | "sleep",
  metadata: Partial<SpriteMetadata>
): void {
  const key = `${species}/${variantId}/${lifeStage}/${visualState}`;
  spriteMetadataRegistry[key] = metadata;
}

/**
 * Looks up sprite metadata for a given sprite combination.
 * Returns validated/clamped metadata, falling back to defaults for any missing or
 * out-of-range values.
 */
export function getSpriteMetadata(
  species: string,
  variantId: string,
  lifeStage: string,
  visualState: "idle" | "sleep"
): SpriteMetadata {
  const key = `${species}/${variantId}/${lifeStage}/${visualState}`;
  const override = spriteMetadataRegistry[key];

  if (override) {
    return validateSpriteMetadata(override);
  }

  return { ...DEFAULT_SPRITE_METADATA };
}
