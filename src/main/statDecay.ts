// src/main/statDecay.ts
// Stat decay engine — runs in the main process on a timer.
// Handles passive decay, cross-stat effects, life stage progression, death, and egg discovery.

import { BrowserWindow } from "electron";
import { randomUUID } from "node:crypto";
import { loadGameState, saveGameState, EGG_HATCH_HOURS } from "./petStorage";
import type { Egg, GameState } from "./petStorage";
import type {
  PetState,
  PetLifeStage,
  PetMood,
  PetSpecies,
} from "../renderer/pet/petVariant";
import { SPECIES_TRAITS } from "../renderer/pet/speciesTraits";
import { PERSONALITY_TRAITS } from "../renderer/pet/personalityTraits";
import { hideOverlay, restoreMainWindow } from "./windowManager";

// Decay tick interval (ms)
const DECAY_TICK_MS = 60_000; // every 60 seconds

// Egg discovery check interval
const EGG_CHECK_INTERVAL_TICKS = 1;

// Base decay rates (points per hour)
const BASE_DECAY = {
  hunger: 12,
  happiness: 5,
  energy: 10,
  cleanliness: 5,
  bond: 0.5,
};

const HP_RECOVERY_RATE = 5;

// Life stage decay multipliers
const STAGE_MULTIPLIERS: Record<PetLifeStage, number> = {
  egg: 0,
  baby: 1.2,
  child: 1.0,
  adult: 1.5,
};

// Egg discovery config
const EGG_DAILY_CHANCE = 1; // TESTING — not used directly when override below is active
const EGG_HOURLY_CHANCE = EGG_DAILY_CHANCE / 24; // TESTING: ~95% chance to find egg within 5 minutes (5 ticks)
const HEALTHY_STAT_THRESHOLD = 60;
const MAX_EGGS = 3;
const SHINY_EGG_CHANCE = 1 / 200;
const SAME_SPECIES_WEIGHT = 2; // 2x more likely to find same species egg

const ALL_SPECIES: PetSpecies[] = ["blob", "frog"];

let decayInterval: ReturnType<typeof setInterval> | null = null;
let tickCount = 0;

/**
 * Starts the decay timer. Should be called once on app ready.
 */
export function startDecayTimer(): void {
  stopDecayTimer();
  tickCount = 0;

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
 * Single decay tick — called every 60 seconds.
 * Iterates over ALL pets in the game state.
 */
function tickDecay(): void {
  const game = loadGameState();
  if (game.pets.length === 0) return;

  const tickHours = DECAY_TICK_MS / (1000 * 60 * 60);
  let anyDied = false;
  const deaths: PetState[] = [];

  // Apply decay to each living pet
  for (let i = 0; i < game.pets.length; i++) {
    const pet = game.pets[i];
    if (!pet.isAlive) continue;

    const updated = applyDecayForHours(pet, tickHours);
    game.pets[i] = updated;

    if (!updated.isAlive) {
      anyDied = true;
      deaths.push(updated);
    }
  }

  // Handle deaths — remove dead pets, add to graveyard (keep only the latest 10)
  for (const deadPet of deaths) {
    game.pets = game.pets.filter((p) => p.id !== deadPet.id);
    game.settings.overlayPets = game.settings.overlayPets.filter(
      (id) => id !== deadPet.id,
    );
    game.graveyard.push({
      id: deadPet.id,
      name: deadPet.name,
      species: deadPet.species,
      color: deadPet.color,
      personality: deadPet.personality,
      isShiny: deadPet.isShiny,
      hatchedAt: deadPet.hatchedAt,
      diedAt: deadPet.diedAt || new Date().toISOString(),
    });
  }
  game.graveyard = game.graveyard.slice(-10);

  // Egg discovery check (once per hour)
  tickCount++;
  if (tickCount >= EGG_CHECK_INTERVAL_TICKS) {
    tickCount = 0;
    checkEggDiscovery(game);
  }

  // Mercy egg: if 0 living pets and 0 eggs, spawn one
  const livingPets = game.pets.filter((p) => p.isAlive);
  if (livingPets.length === 0 && game.eggs.length === 0) {
    spawnMercyEgg(game);
  }

  saveGameState(game);
  broadcastGameState(game);

  if (anyDied) {
    // If all pets are dead, show death screen
    if (livingPets.length === 0) {
      handleAllPetsDead(deaths[deaths.length - 1]);
    } else {
      // Notify about individual deaths
      for (const dead of deaths) {
        broadcastPetDeath(dead);
      }
    }
  }
}

/**
 * Egg discovery — check once per hour for each healthy adult pet.
 */
function checkEggDiscovery(game: GameState): void {
  if (game.eggs.length >= MAX_EGGS) return;

  const livingPets = game.pets.filter((p) => p.isAlive);
  console.log(
    "[petmii] Egg check: living pets =",
    livingPets.length,
    "eggs =",
    game.eggs.length,
  );

  for (const pet of livingPets) {
    if (game.eggs.length >= MAX_EGGS) break;
    const healthy = isPetHealthyForEgg(pet);
    console.log(
      "[petmii] Pet",
      pet.name,
      "healthy for egg:",
      healthy,
      "(bond:",
      pet.bond,
      ")",
    );
    if (!healthy) continue;

    if (Math.random() < EGG_HOURLY_CHANCE) {
      const egg = generateEgg(pet);
      game.eggs.push(egg);
      console.log("[petmii] Egg found!", egg.species, "by", pet.name);
      broadcastEggFound(pet, egg);
    }
  }
}

/**
 * Check if a pet is healthy enough to find eggs.
 * All stats > 60, and pet is adult.
 */
function isPetHealthyForEgg(pet: PetState): boolean {
  if (pet.lifeStage !== "adult") return false;
  if (pet.hunger < HEALTHY_STAT_THRESHOLD) return false;
  if (pet.happiness < HEALTHY_STAT_THRESHOLD) return false;
  if (pet.energy < HEALTHY_STAT_THRESHOLD) return false;
  if (pet.cleanliness < HEALTHY_STAT_THRESHOLD) return false;
  if (pet.bond < HEALTHY_STAT_THRESHOLD) return false;
  return true;
}

/**
 * Generate an egg — species influenced by finder's species.
 */
function generateEgg(finder: PetState): Egg {
  const species = rollEggSpecies(finder.species);
  const now = new Date();
  const hatchMs = EGG_HATCH_HOURS[species] * 60 * 60 * 1000;
  const hatchAt = new Date(now.getTime() + hatchMs);

  return {
    id: randomUUID(),
    species,
    isShiny: Math.random() < SHINY_EGG_CHANCE,
    foundAt: now.toISOString(),
    hatchAt: hatchAt.toISOString(),
    foundBy: finder.id,
  };
}

/**
 * Roll egg species — finder's species is weighted higher.
 */
function rollEggSpecies(finderSpecies: PetSpecies): PetSpecies {
  const weights: { species: PetSpecies; weight: number }[] = ALL_SPECIES.map(
    (s) => ({
      species: s,
      weight: s === finderSpecies ? SAME_SPECIES_WEIGHT : 1,
    }),
  );

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) return entry.species;
  }

  return finderSpecies; // Fallback
}

/**
 * Spawn a mercy egg when 0 pets alive and 0 eggs.
 */
function spawnMercyEgg(game: GameState): void {
  const species = ALL_SPECIES[Math.floor(Math.random() * ALL_SPECIES.length)];
  const now = new Date();
  // Mercy eggs hatch in 1-5 minutes
  const hatchMinutes = 1 + Math.random() * 4;
  const hatchAt = new Date(now.getTime() + hatchMinutes * 60 * 1000);

  const egg: Egg = {
    id: randomUUID(),
    species,
    isShiny: Math.random() < SHINY_EGG_CHANCE,
    foundAt: now.toISOString(),
    hatchAt: hatchAt.toISOString(),
    foundBy: "mercy",
  };

  game.eggs.push(egg);
}

/**
 * Core decay logic — applies decay for a given number of hours.
 */
function applyDecayForHours(pet: PetState, hours: number): PetState {
  let state = { ...pet };

  const speciesTraits = SPECIES_TRAITS[state.species];
  const personalityTraits = PERSONALITY_TRAITS[state.personality];
  const stageMultiplier = STAGE_MULTIPLIERS[state.lifeStage];

  const effectiveDecay = {
    hunger:
      BASE_DECAY.hunger *
      speciesTraits.decay.hunger *
      personalityTraits.decayMultipliers.hunger *
      stageMultiplier,
    happiness:
      BASE_DECAY.happiness *
      speciesTraits.decay.happiness *
      personalityTraits.decayMultipliers.happiness *
      stageMultiplier,
    energy:
      BASE_DECAY.energy *
      speciesTraits.decay.energy *
      personalityTraits.decayMultipliers.energy *
      stageMultiplier,
    cleanliness:
      BASE_DECAY.cleanliness *
      speciesTraits.decay.cleanliness *
      personalityTraits.decayMultipliers.cleanliness *
      stageMultiplier,
    bond:
      BASE_DECAY.bond *
      speciesTraits.decay.bond *
      personalityTraits.decayMultipliers.bond *
      stageMultiplier,
  };

  // Cross-stat effects
  if (state.hunger <= 0) {
    effectiveDecay.energy *= 5;
    effectiveDecay.happiness *= 5;
  } else if (state.hunger < 30) {
    effectiveDecay.happiness *= 3;
  }

  const zeroCount = [state.hunger, state.happiness, state.energy].filter(
    (v) => v <= 0,
  ).length;
  if (zeroCount >= 2) {
    effectiveDecay.hunger *= 10;
    effectiveDecay.happiness *= 10;
    effectiveDecay.energy *= 10;
    effectiveDecay.cleanliness *= 10;
  }

  if (state.cleanliness < 20) effectiveDecay.happiness *= 1.5;
  if (state.energy < 15) effectiveDecay.hunger *= 1.5;
  if (state.happiness < 20) effectiveDecay.bond *= 2;

  // Apply decay
  state.hunger = clamp(state.hunger - effectiveDecay.hunger * hours);
  state.happiness = clamp(state.happiness - effectiveDecay.happiness * hours);
  state.energy = clamp(state.energy - effectiveDecay.energy * hours);
  state.cleanliness = clamp(
    state.cleanliness - effectiveDecay.cleanliness * hours,
  );
  state.bond = clamp(state.bond - effectiveDecay.bond * hours);

  // HP mechanics
  const criticalStats = [
    state.hunger <= 0,
    state.happiness <= 0,
    state.energy <= 0,
  ].filter(Boolean).length;

  const HP_DAMAGE_PER_HOUR = {
    oneCritical: 30,
    twoCritical: 300,
    threeCritical: 1200,
  };

  if (criticalStats >= 3) {
    state.hp = clamp(state.hp - HP_DAMAGE_PER_HOUR.threeCritical * hours);
  } else if (criticalStats >= 2) {
    state.hp = clamp(state.hp - HP_DAMAGE_PER_HOUR.twoCritical * hours);
  } else if (criticalStats >= 1) {
    state.hp = clamp(state.hp - HP_DAMAGE_PER_HOUR.oneCritical * hours);
  }

  if (
    state.hunger > 30 &&
    state.happiness > 20 &&
    criticalStats === 0 &&
    state.hp < 100
  ) {
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
    state.mood = deriveMoodFromStats(state);
    state.lastMessage = deriveMessageFromStats(state);
  }

  // Life stage progression
  state = checkLifeStageProgression(state);

  state.updatedAt = new Date().toISOString();
  return state;
}

/**
 * Life stage progression check — previously auto-advanced lifeStage.
 * Now a no-op: evolution is manual (user clicks Evolve button).
 * Evolution readiness is derived by getEvolutionReadiness() in src/shared/pet/evolutionReadiness.ts.
 */
function checkLifeStageProgression(pet: PetState): PetState {
  // Automatic life-stage mutation removed.
  // Evolution is now user-initiated via the Evolve button in the UI.
  // The getEvolutionReadiness() function determines when a pet is ready to evolve.
  return pet;
}

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
  if (pet.hp < 25) return "I don't feel good...";
  if (pet.hp < 50) return "Help me...";
  if (pet.hp < 80) return "My tummy hurts...";
  if (pet.hunger < 10) return "I'm starving!!";
  if (pet.hunger < 25) return "Feed me~";
  if (pet.energy < 10) return "So... eepy...";
  if (pet.energy < 25) return "I wanna nap...";
  if (pet.cleanliness < 15) return "THIS GUY STINKS!";
  if (pet.happiness < 15) return "I'm lonely...";
  if (pet.happiness < 30) return "Play with me~?";
  if (pet.bond > 80 && pet.happiness > 70) return "I love you!";
  if (pet.happiness > 80) return "Yay~!";
  if (pet.hunger > 80 && pet.happiness > 60) return "Yummy~!";
  if (pet.energy > 80 && pet.happiness > 60) return "Let's go!";

  // Random idle chatter — low chance per tick so pets don't all speak together
  if (Math.random() < 0.2) {
    // 10% per tick per pet
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
  "*yawns*",
  "La la la~",
  "○○○",
  "?",
  "*stretches*",
  "Nom",
  "*wiggles*",
  "^_^",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Handles the case when all pets die — show death screen.
 */
function handleAllPetsDead(lastDead: PetState): void {
  hideOverlay();
  restoreMainWindow();

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("pet:all-died", lastDead);
    }
  }
}

/**
 * Broadcast individual pet death (when other pets still alive).
 */
function broadcastPetDeath(pet: PetState): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("pet:died", pet);
    }
  }
}

/**
 * Broadcasts updated game state to all open windows.
 */
function broadcastGameState(game: GameState): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("game:state-update", game);
    }
  }
}

/**
 * Broadcast egg found notification.
 */
function broadcastEggFound(finder: PetState, egg: Egg): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("egg:found", { finder, egg });
    }
  }
}
