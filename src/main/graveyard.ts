// src/main/graveyard.ts
// Graveyard storage — keeps records of dead pets.

import { app } from "electron";
import path from "path";
import fs from "fs";
import type { PetState, PetSpecies, PetColor, PetPersonality } from "../renderer/pet/petVariant";

const GRAVEYARD_FILENAME = "graveyard.json";

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

function getGraveyardPath(): string {
  return path.join(app.getPath("userData"), GRAVEYARD_FILENAME);
}

/**
 * Loads the graveyard entries from disk.
 */
export function loadGraveyard(): GraveyardEntry[] {
  const filepath = getGraveyardPath();
  try {
    if (!fs.existsSync(filepath)) return [];
    const raw = fs.readFileSync(filepath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Saves the graveyard array to disk.
 */
function saveGraveyard(entries: GraveyardEntry[]): void {
  const filepath = getGraveyardPath();
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, JSON.stringify(entries, null, 2), "utf-8");
}

/**
 * Adds a dead pet to the graveyard.
 */
export function saveToGraveyard(pet: PetState): void {
  const entries = loadGraveyard();
  const entry: GraveyardEntry = {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    color: pet.color,
    personality: pet.personality,
    isShiny: pet.isShiny,
    hatchedAt: pet.hatchedAt,
    diedAt: pet.diedAt || new Date().toISOString(),
  };
  entries.push(entry);
  saveGraveyard(entries);
}

/**
 * Removes a graveyard entry by ID.
 */
export function removeFromGraveyard(id: string): void {
  const entries = loadGraveyard();
  const filtered = entries.filter((e) => e.id !== id);
  saveGraveyard(filtered);
}
