// src/renderer/pet/speciesTraits.ts
// Species-specific decay multipliers and life stage timing.

import type { PetSpecies } from "./petVariant";

/**
 * Decay multipliers per species.
 * Values > 1 mean faster decay (weakness), < 1 mean slower (strength).
 */
export interface SpeciesDecayMultipliers {
  hunger: number;
  happiness: number;
  energy: number;
  cleanliness: number;
  bond: number;
}

/**
 * Life stage timing per species (in hours).
 */
export interface SpeciesStageTiming {
  babyToChild: number; // hours until baby becomes child
  childToAdult: number; // hours until child becomes adult
}

export interface SpeciesTraits {
  decay: SpeciesDecayMultipliers;
  stages: SpeciesStageTiming;
  description: string;
}

export const SPECIES_TRAITS: Record<PetSpecies, SpeciesTraits> = {
  mochi: {
    decay: { hunger: 1.0, happiness: 0.8, energy: 1.0, cleanliness: 1.2, bond: 1.0 },
    stages: { babyToChild: 20, childToAdult: 60 },
    description: "Balanced, gets dirty easily",
  },
  blob: {
    decay: { hunger: 1.3, happiness: 1.0, energy: 0.7, cleanliness: 1.0, bond: 1.0 },
    stages: { babyToChild: 28, childToAdult: 96 },
    description: "Always hungry, but chill energy",
  },
  bun: {
    decay: { hunger: 0.8, happiness: 1.2, energy: 1.0, cleanliness: 1.0, bond: 1.0 },
    stages: { babyToChild: 16, childToAdult: 48 },
    description: "Eats less, needs more attention",
  },
  sprout: {
    decay: { hunger: 1.0, happiness: 1.0, energy: 1.3, cleanliness: 0.7, bond: 1.0 },
    stages: { babyToChild: 36, childToAdult: 120 },
    description: "Tires quickly, stays clean",
  },
  ghost: {
    decay: { hunger: 0.7, happiness: 1.3, energy: 1.0, cleanliness: 0.8, bond: 1.0 },
    stages: { babyToChild: 24, childToAdult: 72 },
    description: "Barely eats, emotionally needy",
  },
  star: {
    decay: { hunger: 1.0, happiness: 1.0, energy: 1.0, cleanliness: 1.0, bond: 1.0 },
    stages: { babyToChild: 24, childToAdult: 72 },
    description: "Perfectly balanced, no weakness",
  },
};
