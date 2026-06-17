// src/main/petStorage.ts
// JSON file-based persistence for pet state with atomic writes and validation.

import { app } from "electron";
import path from "path";
import fs from "fs";
import type { PetState, PetSpecies, PetColor, PetPersonality, PetMood, PetLifeStage } from "../renderer/pet/petVariant";

const PET_STATE_FILENAME = "pet-state.json";

function getStoragePath(): string {
  return path.join(app.getPath("userData"), PET_STATE_FILENAME);
}

const VALID_SPECIES: PetSpecies[] = ["mochi", "blob", "bun", "sprout", "ghost", "star"];
const VALID_COLORS: PetColor[] = ["cream", "pink", "blue", "mint", "lavender", "yellow"];
const VALID_PERSONALITIES: PetPersonality[] = ["sweet", "chaotic", "sleepy", "curious", "shy", "sassy"];
const VALID_MOODS: PetMood[] = ["happy", "sad", "hungry", "sleepy", "playful", "neutral"];
const VALID_LIFE_STAGES: PetLifeStage[] = ["egg", "baby", "child", "adult"];

/**
 * Validates that a value is a number within the 0-100 range (inclusive).
 */
function isStatValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

/**
 * Validates that an unknown value is a valid PetState object.
 * Checks all required fields exist and have valid types/values.
 */
export function validatePetState(data: unknown): data is PetState {
  if (data === null || data === undefined || typeof data !== "object") {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // String fields that must be non-empty
  if (typeof obj.id !== "string" || obj.id.length === 0) return false;
  if (typeof obj.name !== "string" || obj.name.length === 0) return false;
  if (typeof obj.hatchedAt !== "string" || obj.hatchedAt.length === 0) return false;
  if (typeof obj.createdAt !== "string" || obj.createdAt.length === 0) return false;
  if (typeof obj.updatedAt !== "string" || obj.updatedAt.length === 0) return false;

  // Enum fields
  if (!VALID_SPECIES.includes(obj.species as PetSpecies)) return false;
  if (!VALID_COLORS.includes(obj.color as PetColor)) return false;
  if (!VALID_PERSONALITIES.includes(obj.personality as PetPersonality)) return false;
  if (!VALID_MOODS.includes(obj.mood as PetMood)) return false;
  if (!VALID_LIFE_STAGES.includes(obj.lifeStage as PetLifeStage)) return false;

  // Numeric stat fields (0-100)
  if (!isStatValue(obj.hunger)) return false;
  if (!isStatValue(obj.happiness)) return false;
  if (!isStatValue(obj.energy)) return false;
  if (!isStatValue(obj.cleanliness)) return false;
  if (!isStatValue(obj.bond)) return false;

  return true;
}

/**
 * Loads pet state from the JSON storage file.
 * Returns null if the file is missing, corrupted, or contains invalid data.
 */
export function loadPetState(): PetState | null {
  const storagePath = getStoragePath();

  try {
    if (!fs.existsSync(storagePath)) {
      return null;
    }

    const raw = fs.readFileSync(storagePath, "utf-8");
    const parsed = JSON.parse(raw);

    if (!validatePetState(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    // Corrupted JSON or read error — treat as no pet
    return null;
  }
}

/**
 * Saves pet state to the JSON storage file using atomic write.
 * Writes to a temp file first, then renames to the target path.
 * Returns true on success, false on failure.
 */
export function savePetState(state: PetState): boolean {
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
    // Clean up temp file if it exists
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

/**
 * Deletes the pet state storage file.
 * Returns true on success or if the file doesn't exist.
 * Returns false if deletion fails.
 */
export function clearPetState(): boolean {
  const storagePath = getStoragePath();

  try {
    if (!fs.existsSync(storagePath)) {
      return true;
    }

    fs.unlinkSync(storagePath);
    return true;
  } catch {
    return false;
  }
}
