// src/renderer/pet/speciesTraits.ts
// Species-specific decay multipliers and life stage timing.

import type { PetSpecies } from "./petVariant";

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
    stages: { babyToChild: 0.01, childToAdult: 0.01 }, //TESTING
    description: "Always hungry, but chill energy",
  },
  star: {
    decay: {
      hunger: 1.0,
      happiness: 1.0,
      energy: 1.0,
      cleanliness: 1.0,
      bond: 1.0,
    },
    stages: { babyToChild: 24, childToAdult: 72 },
    description: "Perfectly balanced, no weakness",
  },
  frog: {
    decay: {
      hunger: 1.0,
      happiness: 0.8,
      energy: 1.0,
      cleanliness: 1.2,
      bond: 1.0,
    },
    stages: { babyToChild: 0.01, childToAdult: 0.01 }, //TESTING
    description: "Balanced, gets dirty easily",
  },
};
