// src/shared/pet/danceEligibility.ts
// Pure helper functions for dance health and state checks.
// Follows the same pattern as autonomousEligibility.ts.

import { BLOCKING_ACTIONS } from "./autonomousEligibility";

export const DANCE_HEALTH_STAT_THRESHOLD = 50;

/** Checks if all required care stats are at or above threshold */
export function isPetHealthyForDance(stats: {
  hunger: number;
  happiness: number;
  energy: number;
  cleanliness: number;
}): boolean {
  return (
    stats.hunger >= DANCE_HEALTH_STAT_THRESHOLD &&
    stats.happiness >= DANCE_HEALTH_STAT_THRESHOLD &&
    stats.energy >= DANCE_HEALTH_STAT_THRESHOLD &&
    stats.cleanliness >= DANCE_HEALTH_STAT_THRESHOLD
  );
}

/**
 * Full eligibility check for dance. Returns true only when ALL:
 * - Pet is alive
 * - physicsState === "idle"
 * - currentAction is not in BLOCKING_ACTIONS and is not "dance" (self-exclusion)
 * - lifecycleState !== "evolving"
 * - isPetHealthyForDance() returns true
 * - Dance cooldown (normal or cancel) has expired
 */
export function isPetEligibleForDance(
  pet: {
    physicsState: string;
    currentAction: string;
    lifecycleState: string;
    isAlive: boolean;
  },
  stats: {
    hunger: number;
    happiness: number;
    energy: number;
    cleanliness: number;
  },
  cooldownExpiry: number | undefined,
  now: number,
): boolean {
  if (!pet.isAlive) return false;
  if (pet.physicsState !== "idle") return false;
  if (pet.lifecycleState === "evolving") return false;
  if (BLOCKING_ACTIONS.includes(pet.currentAction)) return false;
  if (pet.currentAction === "dance") return false;
  if (!isPetHealthyForDance(stats)) return false;
  if (cooldownExpiry !== undefined && now < cooldownExpiry) return false;

  return true;
}
