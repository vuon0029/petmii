/**
 * Profile Resolver
 *
 * Pure functions for resolving movement profiles via field-by-field merge
 * with priority: exact species+lifeStage → species default → global default.
 *
 * Also provides resolvedRestY computation based on movementStyle.
 */

import {
  MovementProfile,
  PartialMovementProfile,
  SpeciesProfiles,
  GLOBAL_DEFAULT_PROFILE,
} from "./movementProfiles";

/**
 * Resolves a complete MovementProfile for a given species and lifeStage.
 *
 * Resolution priority (field-by-field merge):
 * 1. profiles[species][lifeStage] — exact species+lifeStage match
 * 2. profiles[species].default — species default
 * 3. GLOBAL_DEFAULT_PROFILE — hardcoded fallback
 *
 * Only fields explicitly provided (not undefined) in higher-priority layers
 * override lower-priority defaults.
 */
export function resolveProfile(
  species: string,
  lifeStage: string,
  profiles: Record<string, SpeciesProfiles>
): MovementProfile {
  const speciesProfiles = profiles[species];

  // If species not found, return global default
  if (!speciesProfiles) {
    return { ...GLOBAL_DEFAULT_PROFILE };
  }

  const speciesDefault: MovementProfile = speciesProfiles.default;
  const lifeStagePartial: PartialMovementProfile | undefined =
    lifeStage !== "default" ? speciesProfiles[lifeStage] : undefined;

  // Start with global default as the base
  const base: MovementProfile = { ...GLOBAL_DEFAULT_PROFILE };

  // Merge species default on top (field-by-field)
  const withSpeciesDefault = mergeProfile(base, speciesDefault);

  // If no life-stage-specific profile, return species default merged result
  if (!lifeStagePartial) {
    return withSpeciesDefault;
  }

  // Merge life-stage partial on top
  return mergeProfile(withSpeciesDefault, lifeStagePartial);
}

/**
 * Merges a partial profile on top of a base profile, field-by-field.
 * Only fields that are explicitly defined (not undefined) in the partial
 * override the base values.
 */
function mergeProfile(
  base: MovementProfile,
  override: PartialMovementProfile
): MovementProfile {
  const result: MovementProfile = { ...base };

  if (override.actionType !== undefined) {
    result.actionType = override.actionType;
  }
  if (override.movementStyle !== undefined) {
    result.movementStyle = override.movementStyle;
  }
  if (override.eligibleActions !== undefined) {
    result.eligibleActions = [...override.eligibleActions];
  }
  if (override.stepDistance !== undefined) {
    result.stepDistance = override.stepDistance;
  }
  if (override.hopHeight !== undefined) {
    result.hopHeight = override.hopHeight;
  }
  if (override.duration !== undefined) {
    result.duration = override.duration;
  }
  if (override.interval !== undefined) {
    result.interval = override.interval;
  }
  if (override.landingPauseMs !== undefined) {
    result.landingPauseMs = override.landingPauseMs;
  }
  if (override.hoverOffsetY !== undefined) {
    result.hoverOffsetY = override.hoverOffsetY;
  }
  if (override.groundOffsetY !== undefined) {
    result.groundOffsetY = override.groundOffsetY;
  }
  if (override.actionWeights !== undefined) {
    // Entry-level merge: spread base weights, then override on top.
    // Higher-priority layer entries override matching keys;
    // lower-priority entries not in the override are preserved.
    result.actionWeights = { ...result.actionWeights, ...override.actionWeights };
  }

  return result;
}

/**
 * Computes the resolved resting Y position for a pet based on its movement profile.
 *
 * - Grounded: resolvedRestY = groundY − groundOffsetY
 * - Floating: resolvedRestY = groundY − hoverOffsetY
 *
 * The result is always ≤ groundY (pet never rests below the ground line).
 */
export function computeResolvedRestY(
  groundY: number,
  profile: MovementProfile
): number {
  let restY: number;

  if (profile.movementStyle === "floating") {
    restY = groundY - profile.hoverOffsetY;
  } else {
    // "grounded" or any unrecognized style defaults to grounded behavior
    restY = groundY - profile.groundOffsetY;
  }

  // Ensure resolvedRestY never exceeds groundY
  return Math.min(restY, groundY);
}
