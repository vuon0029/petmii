// src/shared/pet/traitScoring.ts
// Trait scoring and adult trait calculation.
// This module lives in src/shared/pet/ — must NOT import from src/renderer/.

import {
  DOMINANCE_MARGIN,
  MIN_ACTIVITY_THRESHOLD,
  GENTLE_THROW_WEIGHT,
} from "./careConstants";

import type { CareHistory, CareCounts, AdultTrait } from "./careHistory";

/**
 * Computes trait scores from baby and child stage counts.
 * gentleThrow contributes fractionally to both Playful and Affectionate.
 */
export function computeTraitScores(
  babyCounts: CareCounts,
  childCounts: CareCounts
): Record<Exclude<AdultTrait, "Classic">, number> {
  const playScore =
    babyCounts.play +
    childCounts.play +
    GENTLE_THROW_WEIGHT * (babyCounts.gentleThrow + childCounts.gentleThrow);

  const pickedUpScore =
    babyCounts.pickedUp +
    childCounts.pickedUp +
    GENTLE_THROW_WEIGHT * (babyCounts.gentleThrow + childCounts.gentleThrow);

  const restScore = babyCounts.rest + childCounts.rest;

  const hardThrowScore = babyCounts.hardThrow + childCounts.hardThrow;

  return {
    Playful: playScore,
    Affectionate: pickedUpScore,
    Sleepy: restScore,
    Chaotic: hardThrowScore,
  };
}

/**
 * Calculates the Adult Trait from a pet's care history.
 * Uses only baby and child per-stage counts (NOT adult counts).
 * Returns "Classic" if total activity is below threshold or no trait dominates.
 */
export function calculateAdultTrait(history: CareHistory): AdultTrait {
  const babyCounts = history.perStage.baby;
  const childCounts = history.perStage.child;

  const scores = computeTraitScores(babyCounts, childCounts);

  // Sum all relevant activity counts from baby + child stages
  const totalActivity =
    babyCounts.play +
    childCounts.play +
    babyCounts.pickedUp +
    childCounts.pickedUp +
    babyCounts.rest +
    childCounts.rest +
    babyCounts.hardThrow +
    childCounts.hardThrow +
    babyCounts.gentleThrow +
    childCounts.gentleThrow;

  if (totalActivity < MIN_ACTIVITY_THRESHOLD) {
    return "Classic";
  }

  // Find highest and second highest scores
  const entries = Object.entries(scores) as [Exclude<AdultTrait, "Classic">, number][];
  entries.sort((a, b) => b[1] - a[1]);

  const highest = entries[0][1];
  const secondHighest = entries[1][1];

  if (highest - secondHighest < DOMINANCE_MARGIN) {
    return "Classic";
  }

  return entries[0][0];
}
