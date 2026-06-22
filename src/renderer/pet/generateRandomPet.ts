// src/renderer/pet/generateRandomPet.ts
// Random pet variant generator with uniform selection and shiny roll.

import { PetSpecies, PetColor, PetPersonality, PetVariant } from "./petVariant";

export const SPECIES: PetSpecies[] = ["blob", "frog"];
export const COLORS: PetColor[] = ["yellow", "blue", "pink"];
export const PERSONALITIES: PetPersonality[] = [
  "sweet",
  "chaotic",
  "sleepy",
  "curious",
  "shy",
  "sassy",
];

const SHINY_CHANCE = 1 / 200;

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface GeneratedPet {
  variant: PetVariant;
  isShiny: boolean;
}

export function generateRandomPetVariant(): PetVariant {
  return {
    species: randomFrom(SPECIES),
    color: randomFrom(COLORS),
    personality: randomFrom(PERSONALITIES),
    lifeStage: "baby",
  };
}

/**
 * Generates a random pet with shiny roll.
 * Shiny pets get "shiny" as their color.
 */
export function generateRandomPet(): GeneratedPet {
  const isShiny = Math.random() < SHINY_CHANCE;
  const variant: PetVariant = {
    species: randomFrom(SPECIES),
    color: isShiny ? "shiny" : randomFrom(COLORS),
    personality: randomFrom(PERSONALITIES),
    lifeStage: "baby",
  };
  return { variant, isShiny };
}
