// src/renderer/pet/petVariant.ts
// Type definitions and constants for pet variants, state, and defaults.

export type PetSpecies = "mochi" | "blob" | "bun" | "sprout" | "ghost" | "star";
export type PetColor = "cream" | "pink" | "blue" | "mint" | "lavender" | "yellow";
export type PetPersonality = "sweet" | "chaotic" | "sleepy" | "curious" | "shy" | "sassy";

export type PetVariant = {
  species: PetSpecies;
  color: PetColor;
  personality: PetPersonality;
};

export type PetMood = "happy" | "sad" | "hungry" | "sleepy" | "playful" | "neutral";
export type PetLifeStage = "egg" | "baby" | "child" | "adult";

export interface PetState {
  id: string;
  name: string;
  species: PetSpecies;
  color: PetColor;
  personality: PetPersonality;
  hunger: number;
  happiness: number;
  energy: number;
  cleanliness: number;
  bond: number;
  mood: PetMood;
  lifeStage: PetLifeStage;
  lastMessage: string;
  lastFedAt: string | null;
  lastPlayedAt: string | null;
  lastCleanedAt: string | null;
  lastRestedAt: string | null;
  hatchedAt: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PET_STATS = {
  hunger: 15,
  happiness: 15,
  energy: 15,
  cleanliness: 15,
  bond: 10,
  mood: "happy" as PetMood,
  lifeStage: "baby" as PetLifeStage,
  lastMessage: "Your new pet hatched!",
  lastFedAt: null,
  lastPlayedAt: null,
  lastCleanedAt: null,
  lastRestedAt: null,
} as const;

export const SPECIES_DEFAULT_NAMES: Record<PetSpecies, string> = {
  mochi: "Mochi",
  blob: "Bobo",
  bun: "Bun",
  sprout: "Sprout",
  ghost: "Boo",
  star: "Star",
};
