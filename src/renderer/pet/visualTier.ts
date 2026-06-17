// src/renderer/pet/visualTier.ts
// Determines the visual tier for sprite selection based on life stage and age.

import type { PetState, VisualTier } from "./petVariant";

/**
 * Calculates the visual tier of a pet.
 * Baby and Child use their life stage directly.
 * Adults get promoted based on real calendar days alive.
 */
export function getVisualTier(pet: PetState): VisualTier {
  if (pet.lifeStage === "baby") return "baby";
  if (pet.lifeStage === "child") return "child";

  // Adult — check age for elder/legendary
  const ageInDays = getAgeInDays(pet.hatchedAt);

  if (ageInDays >= 121) return "legendary";
  if (ageInDays >= 31) return "elder";
  return "adult";
}

/**
 * Returns the number of full days since hatching.
 */
export function getAgeInDays(hatchedAt: string): number {
  const hatched = new Date(hatchedAt).getTime();
  const now = Date.now();
  return Math.floor((now - hatched) / (1000 * 60 * 60 * 24));
}
