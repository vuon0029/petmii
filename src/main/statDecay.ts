// src/main/statDecay.ts
// Stat decay engine — runs in the main process on a timer.
// Handles passive decay, cross-stat effects, life stage progression, and death.

import { BrowserWindow } from "electron";
import { loadPetState, savePetState } from "./petStorage";
import type { PetState, PetLifeStage, PetMood } from "../renderer/pet/petVariant";
import { SPECIES_TRAITS } from "../renderer/pet/speciesTraits";
import { PERSONALITY_TRAITS } from "../renderer/pet/personalityTraits";
import { saveToGraveyard } from "./graveyard";
import { hideOverlay, restoreMainWindow } from "./windowManager";

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
const HP_RECOVERY_RATE = 2; // HP gained per hour when all stats are okay // HP gained per hour when all stats are okay

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

  const tickHours = DECAY_TICK_MS / (1000 * 60 * 60);
  const updated = applyDecayForHours(pet, tickHours);

  savePetState(updated);
  broadcastState(updated);

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

  // Cross-stat effects — cascading decay
  // Hunger is the leading stat
  if (state.hunger <= 0) {
    // Hunger at 0: energy and happiness decay much faster
    effectiveDecay.energy *= 3;
    effectiveDecay.happiness *= 3;
  } else if (state.hunger < 30) {
    effectiveDecay.happiness *= 2;
  }

  // Cascade: multiple stats at 0 = catastrophic
  const zeroCount = [state.hunger, state.happiness, state.energy].filter((v) => v <= 0).length;
  if (zeroCount >= 2) {
    // Two or more critical stats at 0: everything collapses
    effectiveDecay.hunger *= 2;
    effectiveDecay.happiness *= 2;
    effectiveDecay.energy *= 2;
    effectiveDecay.cleanliness *= 2;
  }

  if (state.cleanliness < 20) effectiveDecay.happiness *= 1.5;
  if (state.energy < 15) effectiveDecay.hunger *= 1.5;
  if (state.happiness < 20) effectiveDecay.bond *= 2;

  // Apply decay
  state.hunger = clamp(state.hunger - effectiveDecay.hunger * hours);
  state.happiness = clamp(state.happiness - effectiveDecay.happiness * hours);
  state.energy = clamp(state.energy - effectiveDecay.energy * hours);
  state.cleanliness = clamp(state.cleanliness - effectiveDecay.cleanliness * hours);
  state.bond = clamp(state.bond - effectiveDecay.bond * hours);

  // HP mechanics — hunger/happiness/energy are the critical triangle
  const criticalStats = [
    state.hunger <= 0,
    state.happiness <= 0,
    state.energy <= 0,
  ].filter(Boolean).length;

  if (criticalStats >= 3) {
    // All three critical stats at 0: rapid death
    state.hp = clamp(state.hp - 60 * hours);
  } else if (criticalStats >= 2) {
    // Two critical stats at 0: fast HP drain
    state.hp = clamp(state.hp - 25 * hours);
  } else if (state.hunger <= 0) {
    // Only hunger at 0: steady HP drain
    state.hp = clamp(state.hp - HP_DAMAGE_RATE * hours);
  }

  // Recovery: only if hunger > 30 and happiness > 20 and no stats at 0
  if (state.hunger > 30 && state.happiness > 20 && criticalStats === 0 && state.hp < 100) {
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
    return { ...pet, lifeStage: "child", lastMessage: "I feel bigger~!" };
  }

  if (pet.lifeStage === "child" && ageHours >= (speciesTraits.stages.babyToChild + speciesTraits.stages.childToAdult) && canEvolve) {
    return { ...pet, lifeStage: "adult", lastMessage: "Look at me now~!" };
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
  if (pet.hp < 25) return "I don't feel so good...";
  if (pet.hp < 50) return "Help me... please...";
  if (pet.hp < 80) return "My tummy hurts...";
  if (pet.hunger < 10) return "I'm starving!!";
  if (pet.hunger < 25) return "Feed me~";
  if (pet.energy < 10) return "So... sleepy...";
  if (pet.energy < 25) return "I wanna nap...";
  if (pet.cleanliness < 15) return "I'm all icky...";
  if (pet.happiness < 15) return "I'm lonely...";
  if (pet.happiness < 30) return "Play with me~?";
  if (pet.bond > 80 && pet.happiness > 70) return "I love you!";
  if (pet.happiness > 80) return "Yay~!";
  if (pet.hunger > 80 && pet.happiness > 60) return "Yummy~!";
  if (pet.energy > 80 && pet.happiness > 60) return "Let's go!";

  // Random idle chatter (~15% chance per tick = ~1.5 messages per 10 min)
  if (Math.random() < 0.90) {
    return randomFrom(IDLE_CHATTER);
  }

  return "~";
}

const IDLE_CHATTER = [
  "♪",
  "♪♪",
  "...",
  "Hmm~",
  "Zzz...",
  "!",
  "~",
  "Hehe",
  "*yawn*",
  "La la la~",
  "○○○",
  "?",
  "*stretch*",
  "Nom",
  "*wiggle*",
  "^^",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Handles pet death — save to graveyard and notify renderer.
 */
function handleDeath(pet: PetState): void {
  saveToGraveyard(pet);

  // Close overlay and restore main window
  hideOverlay();
  restoreMainWindow();

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
