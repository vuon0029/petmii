// src/renderer/pet/petVariant.ts
// Type definitions and constants for pet variants, state, and defaults.

import type { CareHistory, AdultTrait } from "../../shared/pet/careHistory";

export type PetSpecies = "blob" | "frog";
export type PetColor = "yellow" | "blue" | "pink" | "shiny";
export type PetPersonality =
  | "sweet"
  | "chaotic"
  | "sleepy"
  | "curious"
  | "shy"
  | "sassy";

export type PetVariant = {
  species: PetSpecies;
  color: PetColor;
  personality: PetPersonality;
  lifeStage: PetLifeStage;
};

export type PetMood =
  | "happy"
  | "sad"
  | "hungry"
  | "sleepy"
  | "playful"
  | "neutral"
  | "sick"
  | "dead";
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
  hp: number;

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

  // Care history and evolution
  careHistory?: CareHistory;
  adultTrait?: AdultTrait;
}

export const DEFAULT_PET_STATS = {
  hunger: 50,
  happiness: 50,
  energy: 80,
  cleanliness: 80,
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
  blob: "Bob",
  frog: "Ribbon",
};
