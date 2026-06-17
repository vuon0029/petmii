// src/renderer/pet/generateRandomPet.ts
// Random pet variant generator with uniform selection from all species, colors, and personalities.

import { PetSpecies, PetColor, PetPersonality, PetVariant } from "./petVariant";

export const SPECIES: PetSpecies[] = ["mochi", "blob", "bun", "sprout", "ghost", "star"];
export const COLORS: PetColor[] = ["cream", "pink", "blue", "mint", "lavender", "yellow"];
export const PERSONALITIES: PetPersonality[] = ["sweet", "chaotic", "sleepy", "curious", "shy", "sassy"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRandomPetVariant(): PetVariant {

  return {
    species: randomFrom(SPECIES),
    color: randomFrom(COLORS),
    personality: randomFrom(PERSONALITIES),
  };
}
