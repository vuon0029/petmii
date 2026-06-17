// src/renderer/pet/personalityTraits.ts
// Personality-specific stat modifiers.

import type { PetPersonality } from "./petVariant";

/**
 * Personality decay multipliers — applied on top of species multipliers.
 * Also includes bond gain bonus for interactions.
 */
export interface PersonalityModifiers {
  decayMultipliers: {
    hunger: number;
    happiness: number;
    energy: number;
    cleanliness: number;
    bond: number;
  };
  bondGainMultiplier: number; // multiplier for bond gained from any interaction
  description: string;
}

export const PERSONALITY_TRAITS: Record<PetPersonality, PersonalityModifiers> = {
  sweet: {
    decayMultipliers: { hunger: 1.0, happiness: 1.1, energy: 1.0, cleanliness: 1.0, bond: 0.7 },
    bondGainMultiplier: 1.0,
    description: "Bond decays 30% slower, happiness decays 10% faster",
  },
  chaotic: {
    decayMultipliers: { hunger: 1.0, happiness: 1.0, energy: 0.8, cleanliness: 1.4, bond: 1.0 },
    bondGainMultiplier: 1.0,
    description: "Cleanliness decays 40% faster, energy decays 20% slower",
  },
  sleepy: {
    decayMultipliers: { hunger: 0.85, happiness: 1.0, energy: 1.3, cleanliness: 1.0, bond: 1.0 },
    bondGainMultiplier: 1.0,
    description: "Energy decays 30% faster, hunger decays 15% slower",
  },
  curious: {
    decayMultipliers: { hunger: 1.0, happiness: 0.8, energy: 1.15, cleanliness: 1.0, bond: 1.0 },
    bondGainMultiplier: 1.0,
    description: "Happiness decays 20% slower, energy decays 15% faster",
  },
  shy: {
    decayMultipliers: { hunger: 1.0, happiness: 1.0, energy: 1.0, cleanliness: 0.8, bond: 1.4 },
    bondGainMultiplier: 1.0,
    description: "Bond decays 40% faster, cleanliness decays 20% slower",
  },
  sassy: {
    decayMultipliers: { hunger: 1.0, happiness: 1.15, energy: 1.0, cleanliness: 1.0, bond: 1.0 },
    bondGainMultiplier: 1.5,
    description: "Happiness decays 15% faster, bond gains +50% per interaction",
  },
};
