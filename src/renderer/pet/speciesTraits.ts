// src/renderer/pet/speciesTraits.ts
// Species-specific decay multipliers and life stage timing.

import type { PetSpecies } from "./petVariant";
import { TEST_MODE, TEST_BABY_TO_CHILD_HOURS, TEST_CHILD_TO_ADULT_HOURS } from "../../shared/testMode";

export interface SpeciesDecayMultipliers {
  hunger: number;
  happiness: number;
  energy: number;
  cleanliness: number;
  bond: number;
}

export interface SpeciesStageTiming {
  babyToChild: number; // hours
  childToAdult: number; // hours
}

export interface SpeciesTraits {
  decay: SpeciesDecayMultipliers;
  stages: SpeciesStageTiming;
  description: string;
}

export const SPECIES_TRAITS: Record<PetSpecies, SpeciesTraits> = {
  blob: {
    decay: {
      hunger: 1.3,
      happiness: 1.0,
      energy: 0.7,
      cleanliness: 1.0,
      bond: 1.0,
    },
    stages: TEST_MODE
      ? { babyToChild: TEST_BABY_TO_CHILD_HOURS, childToAdult: TEST_CHILD_TO_ADULT_HOURS }
      : { babyToChild: 24, childToAdult: 72 },
    description: "Always hungry, but chill energy",
  },
  frog: {
    decay: {
      hunger: 1.0,
      happiness: 0.8,
      energy: 1.0,
      cleanliness: 1.2,
      bond: 1.0,
    },
    stages: TEST_MODE
      ? { babyToChild: TEST_BABY_TO_CHILD_HOURS, childToAdult: TEST_CHILD_TO_ADULT_HOURS }
      : { babyToChild: 48, childToAdult: 120 },
    description: "Balanced, gets dirty easily",
  },
};
