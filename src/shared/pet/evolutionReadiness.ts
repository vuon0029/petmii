// src/shared/pet/evolutionReadiness.ts
// Derives evolution readiness from total age vs species thresholds.
// This module lives in src/shared/pet/ — must NOT import from src/renderer/.

import { SPECIES_STAGE_THRESHOLDS, type PetSpecies } from "./lifeStageThresholds";

/** Minimal pet data needed for evolution readiness check */
export interface EvolutionReadinessInput {
  species: PetSpecies;
  lifeStage: "baby" | "child" | "adult";
  hatchedAt: number; // timestamp ms
}

export interface EvolutionReadinessResult {
  isReady: boolean;
  nextStage: "child" | "adult" | null;
  remainingHours: number | null; // null when ready or at adult
}

/**
 * Derives evolution readiness from total age.
 * Uses hatchedAt + species threshold (total-age model).
 * @param pet - Minimal pet data with species, lifeStage, and hatchedAt
 * @param now - Current timestamp in ms (defaults to Date.now() for testability)
 */
export function getEvolutionReadiness(
  pet: EvolutionReadinessInput,
  now?: number
): EvolutionReadinessResult {
  const currentTime = now ?? Date.now();

  // Adults cannot evolve further
  if (pet.lifeStage === "adult") {
    return { isReady: false, nextStage: null, remainingHours: null };
  }

  const thresholds = SPECIES_STAGE_THRESHOLDS[pet.species];
  const elapsedHours = (currentTime - pet.hatchedAt) / (1000 * 60 * 60);

  if (pet.lifeStage === "baby") {
    const threshold = thresholds.babyToChild;
    if (elapsedHours >= threshold) {
      return { isReady: true, nextStage: "child", remainingHours: null };
    }
    return {
      isReady: false,
      nextStage: "child",
      remainingHours: threshold - elapsedHours,
    };
  }

  // lifeStage === "child"
  const threshold = thresholds.babyToChild + thresholds.childToAdult;
  if (elapsedHours >= threshold) {
    return { isReady: true, nextStage: "adult", remainingHours: null };
  }
  return {
    isReady: false,
    nextStage: "adult",
    remainingHours: threshold - elapsedHours,
  };
}
