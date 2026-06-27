/**
 * Fallback sprite resolver.
 * Implements a 5-step fallback chain for resolving sprite assets from the registry.
 * Returns { src, metadata } on success or null to trigger CSS fallback avatar.
 */

import {
  SpriteMetadata,
  DEFAULT_SPRITE_METADATA,
  validateSpriteMetadata,
} from "./spriteMetadata";

/**
 * A single sprite entry in the registry, with its resolved src path
 * and optional metadata overrides.
 */
export interface SpriteEntry {
  src: string;
  metadata?: Partial<SpriteMetadata>;
}

/**
 * Nested registry mapping species → variantId → lifeStage → visualState → SpriteEntry.
 * Used for synchronous sprite lookup at render time (no async file-system checks).
 */
export type SpriteRegistry = Record<
  string, // species
  Record<
    string, // variantId
    Record<
      string, // lifeStage
      Record<
        string, // visualState ("idle" | "sleep")
        SpriteEntry
      >
    >
  >
>;

/** Result returned by resolveSprite when an asset is found in the registry. */
export interface ResolvedSprite {
  src: string;
  metadata: SpriteMetadata;
}

/**
 * Returns the default variant for a given species from the registry.
 * Convention: the first variant key listed in the registry is the default.
 * Returns undefined if the species has no variants registered.
 */
function getDefaultVariant(
  species: string,
  registry: SpriteRegistry
): string | undefined {
  const speciesEntry = registry[species];
  if (!speciesEntry) return undefined;
  const variants = Object.keys(speciesEntry);
  return variants.length > 0 ? variants[0] : undefined;
}

/**
 * Attempts to look up a sprite entry in the registry at the given coordinates.
 * Returns the SpriteEntry if found, undefined otherwise.
 */
function lookupEntry(
  registry: SpriteRegistry,
  species: string,
  variantId: string,
  lifeStage: string,
  visualState: string
): SpriteEntry | undefined {
  return registry[species]?.[variantId]?.[lifeStage]?.[visualState];
}

/**
 * Converts a SpriteEntry to a ResolvedSprite by validating/clamping metadata.
 */
function toResolved(entry: SpriteEntry): ResolvedSprite {
  const metadata = entry.metadata
    ? validateSpriteMetadata(entry.metadata)
    : { ...DEFAULT_SPRITE_METADATA };
  return { src: entry.src, metadata };
}

/**
 * Resolves a sprite using the 5-step fallback chain:
 *
 * 1. species/variantId/lifeStage + requested visualState (exact match)
 * 2. species/variantId/lifeStage + "idle" (idle fallback for same variant+lifeStage)
 * 3. species/{defaultVariant}/lifeStage + "idle" (default variant fallback)
 * 4. species/variantId/adult + "idle" (adult fallback)
 * 5. null → CSS fallback avatar
 *
 * The lookup is synchronous — no async file-system checks.
 *
 * @param species - The pet species (e.g., "frog", "blob")
 * @param variantId - The variant identifier (e.g., "yellow", "blue")
 * @param lifeStage - The life stage (e.g., "baby", "child", "adult")
 * @param visualState - The requested visual state ("idle" or "sleep")
 * @param registry - The sprite registry to look up entries from
 * @returns ResolvedSprite with src and validated metadata, or null for CSS fallback
 */
export function resolveSprite(
  species: string,
  variantId: string,
  lifeStage: string,
  visualState: string,
  registry: SpriteRegistry
): ResolvedSprite | null {
  // Step 1: Exact match — species/variantId/lifeStage + requested visualState
  const step1 = lookupEntry(registry, species, variantId, lifeStage, visualState);
  if (step1) return toResolved(step1);

  // Step 2: Idle fallback — species/variantId/lifeStage + "idle"
  if (visualState !== "idle") {
    const step2 = lookupEntry(registry, species, variantId, lifeStage, "idle");
    if (step2) return toResolved(step2);
  }

  // Step 3: Default variant fallback — species/{defaultVariant}/lifeStage + "idle"
  const defaultVariant = getDefaultVariant(species, registry);
  if (defaultVariant && defaultVariant !== variantId) {
    const step3 = lookupEntry(registry, species, defaultVariant, lifeStage, "idle");
    if (step3) return toResolved(step3);
  }

  // Step 4: Adult fallback — species/variantId/adult + "idle"
  if (lifeStage !== "adult") {
    const step4 = lookupEntry(registry, species, variantId, "adult", "idle");
    if (step4) return toResolved(step4);
  }

  // Step 5: CSS fallback — return null
  return null;
}
