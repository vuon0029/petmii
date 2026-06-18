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

export type PetMood = "happy" | "sad" | "hungry" | "sleepy" | "playful" | "neutral" | "sick" | "dead";
export type PetLifeStage = "egg" | "baby" | "child" | "adult";
export type VisualTier = "baby" | "child" | "adult" | "elder" | "legendary";

export interface PetState {
  id: string;
  name: string;
  species: PetSpecies;
  color: PetColor;
  personality: PetPersonality;
  isShiny: boolean;

  // Stats (0-100)
  hunger: number;
  happiness: number;
  energy: number;
  cleanliness: number;
  bond: number;
  hp: number; // hidden from UI, 0-100

  // State
  isAlive: boolean;
  mood: PetMood;
  lifeStage: PetLifeStage;

  // Messages
  lastMessage: string;

  // Timestamps
  lastFedAt: string | null;
  lastPlayedAt: string | null;
  lastCleanedAt: string | null;
  lastRestedAt: string | null;
  hatchedAt: string;
  diedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PET_STATS = {
  hunger: 75,
  happiness: 70,
  energy: 80,
  cleanliness: 85,
  bond: 10,
  hp: 100,
  isShiny: false,
  isAlive: true,
  mood: "happy" as PetMood,
  lifeStage: "baby" as PetLifeStage,
  lastMessage: "Hewwo~!",
  lastFedAt: null,
  lastPlayedAt: null,
  lastCleanedAt: null,
  lastRestedAt: null,
  diedAt: null,
} as const;

export const SPECIES_DEFAULT_NAMES: Record<PetSpecies, string> = {
  mochi: "Mochi",
  blob: "Bobo",
  bun: "Bun",
  sprout: "Sprout",
  ghost: "Boo",
  star: "Star",
};
