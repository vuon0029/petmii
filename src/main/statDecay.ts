// src/main/statDecay.ts
// Stat decay engine — runs in the main process on a timer.
// Handles passive decay, cross-stat effects, life stage progression, and death.

import { BrowserWindow } from "electron";
import { loadPetState, savePetState } from "./petStorage";
import { saveToGraveyard } from "./graveyard";
import type { PetState, PetLifeStage, PetMood } from "../renderer/pet/petVariant";
import { SPECIES_TRAITS } from "../renderer/pet/speciesTraits";
import { PERSONALITY_TRAITS } from "../renderer/pet/personalityTraits";

// Decay tick interval (ms)
const DECAY_TICK_MS = 60_000; // every 60 seconds

// Base decay rates (points per hour)
const BASE_DECAY = {
  hunger: 4,
  happiness: 2.5,
  energy: 2,
  cleanliness: 1.5,
  bond: 0.5,
};

// HP mechanics
const HP_DAMAGE_RATE = 5; // HP lost per hour when hunger = 0
const HP_DAMAGE_CRITICAL = 3; // additional HP lost per hour when happiness = 0 AND hunger < 10
const HP_RECOVERY_RATE = 2; // HP gained per hour when hunger > 30 and happiness > 20

// Life stage decay multipliers
const STAGE_MULTIPLIERS: Record<PetLifeStage, number> = {
  egg: 0,
  baby: 1.5,
  child: 1.0,
  adult: 0.8,
};

// Max offline catch-up (hours)
const MAX_CATCHUP_HOURS = 48;

let decayInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the decay timer. Should be called once on app ready.
 */
export function startDecayTimer(): void {
  stopDecayTimer();

  // On start, apply catch-up decay for time elapsed since last update
  applyCatchUpDecay();

  decayInterval = setInterval(() => {
    tickDecay();
  }, DECAY_TICK_MS);
}

export function stopDecayTimer(): void {
  if (decayInterval !== null) {
    clearInterval(decayInterval);
    decayInterval = null;
  }
}

/**
 * Applies catch-up decay for the time the app was closed.
 */
function applyCatchUpDecay(): void {
  const pet = loadPetState();
  if (!pet || !pet.isAlive) return;

  const now = Date.now();
  const lastUpdate = new Date(pet.updatedAt).getTime();
  const elapsedMs = now - lastUpdate;
  const elapsedHours = Math.min(elapsedMs / (1000 * 60 * 60), MAX_CATCHUP_HOURS);

  if (elapsedHours < 0.01) return; // less than ~36 seconds, skip

  const updated = applyDecayForHours(pet, elapsedHours);
  savePetState(updated);
  broadcastState(updated);
}

/**
 * Single decay tick — called every 60 seconds.
 */
function tickDecay(): void {
  const pet = loadPetState();
  if (!pet || !pet.isAlive) return;

  const tickHours = DECAY_TICK_MS / (1000 * 60 * 60); // ~0.0167 hours
  const updated = applyDecayForHours(pet, tickHours);

  savePetState(updated);
  broadcastState(updated);

  // Check for death
  if (!updated.isAlive) {
    handleDeath(updated);
  }
}

/**
 * Core decay logic — applies decay for a given number of hours.
 * Handles cross-stat effects, species/personality modifiers, HP, life stages.
 */
function applyDecayForHours(pet: PetState, hours: number): PetState {
  let state = { ...pet };

  const speciesTraits = SPECIES_TRAITS[state.species];
  const personalityTraits = PERSONALITY_TRAITS[state.personality];
  const stageMultiplier = STAGE_MULTIPLIERS[state.lifeStage];

  // Calculate effective decay rates
  const effectiveDecay = {
    hunger: BASE_DECAY.hunger * speciesTraits.decay.hunger * personalityTraits.decayMultipliers.hunger * stageMultiplier,
    happiness: BASE_DECAY.happiness * speciesTraits.decay.happiness * personalityTraits.decayMultipliers.happiness * stageMultiplier,
    energy: BASE_DECAY.energy * speciesTraits.decay.energy * personalityTraits.decayMultipliers.energy * stageMultiplier,
    cleanliness: BASE_DECAY.cleanliness * speciesTraits.decay.cleanliness * personalityTraits.decayMultipliers.cleanliness * stageMultiplier,
    bond: BASE_DECAY.bond * speciesTraits.decay.bond * personalityTraits.decayMultipliers.bond * stageMultiplier,
  };

  // Cross-stat effects
  if (state.hunger < 30) effectiveDecay.happiness *= 2;
  if (state.cleanliness < 20) effectiveDecay.happiness *= 1.5;
  if (state.energy < 15) effectiveDecay.hunger *= 1.5;
  if (state.happiness < 20) effectiveDecay.bond *= 2;

  // Apply decay
  state.hunger = clamp(state.hunger - effectiveDecay.hunger * hours);
  state.happiness = clamp(state.happiness - effectiveDecay.happiness * hours);
  state.energy = clamp(state.energy - effectiveDecay.energy * hours);
  state.cleanliness = clamp(state.cleanliness - effectiveDecay.cleanliness * hours);
  state.bond = clamp(state.bond - effectiveDecay.bond * hours);

  // HP mechanics
  if (state.hunger <= 0) {
    state.hp = clamp(state.hp - HP_DAMAGE_RATE * hours);
  }
  if (state.happiness <= 0 && state.hunger < 10) {
    state.hp = clamp(state.hp - HP_DAMAGE_CRITICAL * hours);
  }
  if (state.hunger > 30 && state.happiness > 20 && state.hp < 100) {
    state.hp = clamp(state.hp + HP_RECOVERY_RATE * hours);
  }

  // Death check
  if (state.hp <= 0) {
    state.hp = 0;
    state.isAlive = false;
    state.diedAt = new Date().toISOString();
    state.mood = "dead";
    state.lastMessage = "...";
  } else {
    // Derive mood
    state.mood = deriveMoodFromStats(state);
    state.lastMessage = deriveMessageFromStats(state);
  }

  // Life stage progression
  state = checkLifeStageProgression(state);

  state.updatedAt = new Date().toISOString();
  return state;
}

/**
 * Check if the pet should progress to the next life stage.
 */
function checkLifeStageProgression(pet: PetState): PetState {
  if (!pet.isAlive) return pet;

  const speciesTraits = SPECIES_TRAITS[pet.species];
  const ageHours = (Date.now() - new Date(pet.hatchedAt).getTime()) / (1000 * 60 * 60);

  // Must have minimum stats to evolve (hunger > 20)
  const canEvolve = pet.hunger > 20;

  if (pet.lifeStage === "baby" && ageHours >= speciesTraits.stages.babyToChild && canEvolve) {
    return { ...pet, lifeStage: "child", lastMessage: "Your pet grew into a child!" };
  }

  if (pet.lifeStage === "child" && ageHours >= (speciesTraits.stages.babyToChild + speciesTraits.stages.childToAdult) && canEvolve) {
    return { ...pet, lifeStage: "adult", lastMessage: "Your pet is now an adult!" };
  }

  return pet;
}

/**
 * Mood derivation (duplicated here to avoid renderer imports in main process).
 */
function deriveMoodFromStats(pet: PetState): PetMood {
  if (!pet.isAlive) return "dead";
  if (pet.hp < 40) return "sick";
  if (pet.hunger < 15) return "hungry";
  if (pet.energy < 15) return "sleepy";
  if (pet.happiness < 20) return "sad";
  if (pet.happiness > 70 && pet.hunger > 50 && pet.energy > 50) return "happy";
  if (pet.happiness > 60 && pet.energy > 60) return "playful";
  return "neutral";
}

function deriveMessageFromStats(pet: PetState): string {
  if (pet.hp < 10) return "...";
  if (pet.hp < 25) return "I'm really struggling...";
  if (pet.hp < 50) return "Please take care of me...";
  if (pet.hp < 80) return "I'm not feeling great...";
  if (pet.hunger < 10) return "I'm starving!";
  if (pet.hunger < 25) return "I'm so hungry...";
  if (pet.energy < 10) return "I can barely keep my eyes open...";
  if (pet.energy < 25) return "I'm exhausted...";
  if (pet.cleanliness < 15) return "I feel so dirty...";
  if (pet.happiness < 15) return "I'm so lonely...";
  if (pet.happiness < 30) return "Play with me?";
  if (pet.bond > 80 && pet.happiness > 70) return "I love being with you!";
  if (pet.happiness > 80) return "Life is wonderful!";
  return "~";
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Handles pet death — save to graveyard and notify renderer.
 */
function handleDeath(pet: PetState): void {
  saveToGraveyard(pet);

  // Notify all windows about death
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("pet:died", pet);
    }
  }
}

/**
 * Broadcasts updated pet state to all open windows.
 */
function broadcastState(pet: PetState): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("pet:state-update", pet);
    }
  }
}
