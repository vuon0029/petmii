// src/renderer/pet/generateRandomPet.ts
// Random pet variant generator with uniform selection and shiny roll.

import { PetSpecies, PetColor, PetPersonality, PetVariant } from "./petVariant";

export const SPECIES: PetSpecies[] = ["mochi", "blob", "bun", "sprout", "ghost", "star"];
export const COLORS: PetColor[] = ["cream", "pink", "blue", "mint", "lavender", "yellow"];
export const PERSONALITIES: PetPersonality[] = ["sweet", "chaotic", "sleepy", "curious", "shy", "sassy"];

const SHINY_CHANCE = 1 / 4000;

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface GeneratedPet {
  variant: PetVariant;
  isShiny: boolean;
}

export function generateRandomPetVariant(): PetVariant {
  return {
    species: 'blob',
    color: randomFrom(COLORS),
    personality: randomFrom(PERSONALITIES),
  };
}

/**
 * Generates a random pet with shiny roll.
 */
export function generateRandomPet(): GeneratedPet {
  return {
    variant: generateRandomPetVariant(),
    isShiny: Math.random() < SHINY_CHANCE,
  };
}
