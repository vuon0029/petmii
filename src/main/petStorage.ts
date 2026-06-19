// src/main/petStorage.ts
// JSON file-based persistence for game state (multi-pet + eggs) with atomic writes.

import { app } from "electron";
import path from "path";
import fs from "fs";
import type {
  PetState,
  PetSpecies,
  PetColor,
  PetPersonality,
  PetMood,
  PetLifeStage,
} from "../renderer/pet/petVariant";

// ===== Types =====

export interface Egg {
  id: string;
  species: PetSpecies;
  isShiny: boolean;
  foundAt: string;
  hatchAt: string;
  foundBy: string;
}

export interface GameState {
  pets: PetState[];
  eggs: Egg[];
  graveyard: GraveyardEntry[];
  settings: {
    overlayPets: string[];
  };
}

export interface GraveyardEntry {
  id: string;
  name: string;
  species: PetSpecies;
  color: PetColor;
  personality: PetPersonality;
  isShiny: boolean;
  hatchedAt: string;
  diedAt: string;
}

// ===== Constants =====

const GAME_STATE_FILENAME = "game-state.json";
const OLD_PET_STATE_FILENAME = "pet-state.json";
const MAX_PETS = 6;
const MAX_EGGS = 3;
const MAX_OVERLAY_PETS = 4;

// (normal: blob:6, star:12, frog:4)
export const EGG_HATCH_HOURS: Record<PetSpecies, number> = {
  blob: 0.5,
  star: 1,
  frog: 0.7,
};

const VALID_SPECIES: PetSpecies[] = ["blob", "star", "frog"];
const VALID_COLORS: PetColor[] = ["yellow", "blue", "pink", "shiny"];
const VALID_PERSONALITIES: PetPersonality[] = [
  "sweet",
  "chaotic",
  "sleepy",
  "curious",
  "shy",
  "sassy",
];
const VALID_MOODS: PetMood[] = [
  "happy",
  "sad",
  "hungry",
  "sleepy",
  "playful",
  "neutral",
  "sick",
  "dead",
];
const VALID_LIFE_STAGES: PetLifeStage[] = ["egg", "baby", "child", "adult"];

// ===== Paths =====

function getStoragePath(): string {
  return path.join(app.getPath("userData"), GAME_STATE_FILENAME);
}

function getOldStoragePath(): string {
  return path.join(app.getPath("userData"), OLD_PET_STATE_FILENAME);
}

// ===== Validation =====

function isStatValue(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

export function validatePetState(data: unknown): data is PetState {
  if (data === null || data === undefined || typeof data !== "object") {
    return false;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== "string" || obj.id.length === 0) return false;
  if (typeof obj.name !== "string" || obj.name.length === 0) return false;
  if (typeof obj.hatchedAt !== "string" || obj.hatchedAt.length === 0)
    return false;
  if (typeof obj.createdAt !== "string" || obj.createdAt.length === 0)
    return false;
  if (typeof obj.updatedAt !== "string" || obj.updatedAt.length === 0)
    return false;

  if (!VALID_SPECIES.includes(obj.species as PetSpecies)) return false;
  if (!VALID_COLORS.includes(obj.color as PetColor)) return false;
  if (!VALID_PERSONALITIES.includes(obj.personality as PetPersonality))
    return false;
  if (!VALID_MOODS.includes(obj.mood as PetMood)) return false;
  if (!VALID_LIFE_STAGES.includes(obj.lifeStage as PetLifeStage)) return false;

  if (typeof obj.isAlive !== "boolean") return false;
  if (typeof obj.isShiny !== "boolean") return false;

  if (!isStatValue(obj.hunger)) return false;
  if (!isStatValue(obj.happiness)) return false;
  if (!isStatValue(obj.energy)) return false;
  if (!isStatValue(obj.cleanliness)) return false;
  if (!isStatValue(obj.bond)) return false;
  if (!isStatValue(obj.hp)) return false;

  return true;
}

// ===== Default State =====

function createDefaultGameState(): GameState {
  return {
    pets: [],
    eggs: [],
    graveyard: [],
    settings: {
      overlayPets: [],
    },
  };
}

// ===== Migration from old pet-state.json =====

function migrateFromOldFormat(): GameState | null {
  const oldPath = getOldStoragePath();
  try {
    if (!fs.existsSync(oldPath)) return null;

    const raw = fs.readFileSync(oldPath, "utf-8");
    const parsed = JSON.parse(raw);

    if (parsed === null || typeof parsed !== "object") return null;

    // Apply same migrations as before
    if (typeof parsed.isShiny !== "boolean") parsed.isShiny = false;
    if (typeof parsed.isAlive !== "boolean") parsed.isAlive = true;
    if (typeof parsed.hp !== "number") parsed.hp = 100;
    if (typeof parsed.diedAt === "undefined") parsed.diedAt = null;

    if (!validatePetState(parsed)) return null;

    const gameState = createDefaultGameState();
    if (parsed.isAlive) {
      gameState.pets = [parsed];
      gameState.settings.overlayPets = [parsed.id];
    }

    // Load existing graveyard if any
    const graveyardPath = path.join(app.getPath("userData"), "graveyard.json");
    try {
      if (fs.existsSync(graveyardPath)) {
        const graveyardRaw = fs.readFileSync(graveyardPath, "utf-8");
        const graveyardParsed = JSON.parse(graveyardRaw);
        if (Array.isArray(graveyardParsed)) {
          gameState.graveyard = graveyardParsed;
        }
      }
    } catch {
      // Ignore graveyard migration errors
    }

    return gameState;
  } catch {
    return null;
  }
}

// ===== Core Load/Save =====

/**
 * Loads the full game state from disk. Migrates from old format if needed.
 * Returns a default empty state if nothing found.
 */
export function loadGameState(): GameState {
  const storagePath = getStoragePath();

  try {
    if (fs.existsSync(storagePath)) {
      const raw = fs.readFileSync(storagePath, "utf-8");
      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === "object" && Array.isArray(parsed.pets)) {
        // Validate and clean up
        const state: GameState = {
          pets: (parsed.pets || []).filter((p: unknown) => validatePetState(p)),
          eggs: Array.isArray(parsed.eggs) ? parsed.eggs : [],
          graveyard: Array.isArray(parsed.graveyard) ? parsed.graveyard : [],
          settings: {
            overlayPets: Array.isArray(parsed.settings?.overlayPets)
              ? parsed.settings.overlayPets
              : [],
          },
        };
        return state;
      }
    }

    // Try migrating from old format
    const migrated = migrateFromOldFormat();
    if (migrated) {
      saveGameState(migrated);
      return migrated;
    }
  } catch {
    // Fall through to default
  }

  return createDefaultGameState();
}

/**
 * Saves the full game state to disk using atomic write.
 */
export function saveGameState(state: GameState): boolean {
  const storagePath = getStoragePath();
  const tempPath = storagePath + ".tmp";

  try {
    const dir = path.dirname(storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const json = JSON.stringify(state, null, 2);
    fs.writeFileSync(tempPath, json, "utf-8");
    fs.renameSync(tempPath, storagePath);
    return true;
  } catch {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    return false;
  }
}

// ===== Convenience methods (backwards-compatible API) =====

/**
 * Loads the first living pet (for backwards compat with single-pet code).
 */
export function loadPetState(): PetState | null {
  const game = loadGameState();
  return game.pets.find((p) => p.isAlive) || null;
}

/**
 * Saves/updates a single pet in the game state array.
 */
export function savePetState(state: PetState): boolean {
  const game = loadGameState();
  const idx = game.pets.findIndex((p) => p.id === state.id);
  if (idx >= 0) {
    game.pets[idx] = state;
  } else if (game.pets.length < MAX_PETS) {
    game.pets.push(state);
  } else {
    return false;
  }
  return saveGameState(game);
}

/**
 * Clears all pets and eggs (full reset).
 */
export function clearPetState(): boolean {
  const game = loadGameState();
  game.pets = [];
  game.eggs = [];
  game.settings.overlayPets = [];
  return saveGameState(game);
}

// ===== Multi-pet helpers =====

/**
 * Adds a new pet to the game state.
 */
export function addPet(pet: PetState): boolean {
  const game = loadGameState();
  if (game.pets.length >= MAX_PETS) return false;
  game.pets.push(pet);
  // Auto-add to overlay if under limit
  if (game.settings.overlayPets.length < MAX_OVERLAY_PETS) {
    game.settings.overlayPets.push(pet.id);
  }
  return saveGameState(game);
}

/**
 * Removes a pet by ID and adds to graveyard.
 */
export function removePet(petId: string): boolean {
  const game = loadGameState();
  const pet = game.pets.find((p) => p.id === petId);
  if (!pet) return false;

  game.pets = game.pets.filter((p) => p.id !== petId);
  game.settings.overlayPets = game.settings.overlayPets.filter(
    (id) => id !== petId,
  );

  // Add to graveyard
  game.graveyard.push({
    id: pet.id,
    name: pet.name,
    species: pet.species,
    color: pet.color,
    personality: pet.personality,
    isShiny: pet.isShiny,
    hatchedAt: pet.hatchedAt,
    diedAt: pet.diedAt || new Date().toISOString(),
  });

  return saveGameState(game);
}

// ===== Egg helpers =====

/**
 * Adds an egg to the game state.
 */
export function addEgg(egg: Egg): boolean {
  const game = loadGameState();
  if (game.eggs.length >= MAX_EGGS) return false;
  game.eggs.push(egg);
  return saveGameState(game);
}

/**
 * Removes an egg by ID (after hatching).
 */
export function removeEgg(eggId: string): Egg | null {
  const game = loadGameState();
  const egg = game.eggs.find((e) => e.id === eggId);
  if (!egg) return null;
  game.eggs = game.eggs.filter((e) => e.id !== eggId);
  saveGameState(game);
  return egg;
}

/**
 * Gets eggs that are ready to hatch (current time >= hatchAt).
 */
export function getReadyEggs(): Egg[] {
  const game = loadGameState();
  const now = Date.now();
  return game.eggs.filter((e) => now >= new Date(e.hatchAt).getTime());
}

// ===== Overlay settings =====

export function setOverlayPets(petIds: string[]): boolean {
  const game = loadGameState();
  game.settings.overlayPets = petIds.slice(0, MAX_OVERLAY_PETS);
  return saveGameState(game);
}

export function getOverlayPets(): string[] {
  const game = loadGameState();
  // Filter to only living pets
  const livingIds = new Set(
    game.pets.filter((p) => p.isAlive).map((p) => p.id),
  );
  return game.settings.overlayPets.filter((id) => livingIds.has(id));
}
