// src/main/petStorage.test.ts
// Unit tests for petStorage module

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import type { PetState } from "../renderer/pet/petVariant";

const TEST_DIR = path.join(os.tmpdir(), "petmii-test-" + process.pid);

// Mock electron's app module before importing the module under test
vi.mock("electron", () => ({
  app: {
    getPath: () => TEST_DIR,
  },
}));

// Import after mock setup
import { validatePetState, loadPetState, savePetState, clearPetState } from "./petStorage";

function createValidPetState(overrides: Partial<PetState> = {}): PetState {
  return {
    id: "test-pet-123",
    name: "Mochi",
    species: "mochi",
    color: "cream",
    personality: "sweet",
    hunger: 75,
    happiness: 70,
    energy: 80,
    cleanliness: 85,
    bond: 10,
    mood: "happy",
    lifeStage: "baby",
    lastMessage: "Your new pet hatched!",
    lastFedAt: null,
    lastPlayedAt: null,
    lastCleanedAt: null,
    lastRestedAt: null,
    hatchedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function getTestStoragePath(): string {
  return path.join(TEST_DIR, "pet-state.json");
}

function ensureTestDir(): void {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
}

function cleanupTestDir(): void {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

describe("petStorage", () => {
  beforeEach(() => {
    ensureTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  describe("validatePetState", () => {
    it("returns true for a valid PetState object", () => {
      const state = createValidPetState();
      expect(validatePetState(state)).toBe(true);
    });

    it("returns false for null", () => {
      expect(validatePetState(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(validatePetState(undefined)).toBe(false);
    });

    it("returns false for non-object types", () => {
      expect(validatePetState("string")).toBe(false);
      expect(validatePetState(42)).toBe(false);
      expect(validatePetState(true)).toBe(false);
      expect(validatePetState([])).toBe(false);
    });

    it("returns false when id is missing", () => {
      const state = createValidPetState();
      delete (state as Record<string, unknown>).id;
      expect(validatePetState(state)).toBe(false);
    });

    it("returns false when id is empty string", () => {
      const state = createValidPetState({ id: "" });
      expect(validatePetState(state)).toBe(false);
    });

    it("returns false when name is empty string", () => {
      const state = createValidPetState({ name: "" });
      expect(validatePetState(state)).toBe(false);
    });

    it("returns false for invalid species", () => {
      const state = createValidPetState();
      (state as Record<string, unknown>).species = "dragon";
      expect(validatePetState(state)).toBe(false);
    });

    it("returns false for invalid color", () => {
      const state = createValidPetState();
      (state as Record<string, unknown>).color = "red";
      expect(validatePetState(state)).toBe(false);
    });

    it("returns false for invalid personality", () => {
      const state = createValidPetState();
      (state as Record<string, unknown>).personality = "angry";
      expect(validatePetState(state)).toBe(false);
    });

    it("returns false for invalid mood", () => {
      const state = createValidPetState();
      (state as Record<string, unknown>).mood = "excited";
      expect(validatePetState(state)).toBe(false);
    });

    it("returns false for invalid lifeStage", () => {
      const state = createValidPetState();
      (state as Record<string, unknown>).lifeStage = "elder";
      expect(validatePetState(state)).toBe(false);
    });

    it("returns false when hunger is out of range", () => {
      expect(validatePetState(createValidPetState({ hunger: -1 }))).toBe(false);
      expect(validatePetState(createValidPetState({ hunger: 101 }))).toBe(false);
    });

    it("returns false when happiness is out of range", () => {
      expect(validatePetState(createValidPetState({ happiness: -5 }))).toBe(false);
      expect(validatePetState(createValidPetState({ happiness: 200 }))).toBe(false);
    });

    it("returns false when stats are not numbers", () => {
      const state = createValidPetState();
      (state as Record<string, unknown>).energy = "high";
      expect(validatePetState(state)).toBe(false);
    });

    it("returns false when stats are NaN", () => {
      const state = createValidPetState();
      (state as Record<string, unknown>).bond = NaN;
      expect(validatePetState(state)).toBe(false);
    });

    it("returns false when stats are Infinity", () => {
      const state = createValidPetState();
      (state as Record<string, unknown>).cleanliness = Infinity;
      expect(validatePetState(state)).toBe(false);
    });

    it("accepts boundary stat values 0 and 100", () => {
      expect(validatePetState(createValidPetState({ hunger: 0 }))).toBe(true);
      expect(validatePetState(createValidPetState({ hunger: 100 }))).toBe(true);
      expect(validatePetState(createValidPetState({ bond: 0 }))).toBe(true);
      expect(validatePetState(createValidPetState({ bond: 100 }))).toBe(true);
    });

    it("returns false when timestamp fields are empty", () => {
      expect(validatePetState(createValidPetState({ hatchedAt: "" }))).toBe(false);
      expect(validatePetState(createValidPetState({ createdAt: "" }))).toBe(false);
      expect(validatePetState(createValidPetState({ updatedAt: "" }))).toBe(false);
    });
  });

  describe("loadPetState", () => {
    it("returns null when storage file does not exist", () => {
      const result = loadPetState();
      expect(result).toBeNull();
    });

    it("returns valid PetState when file contains valid data", () => {
      const state = createValidPetState();
      const storagePath = getTestStoragePath();
      fs.writeFileSync(storagePath, JSON.stringify(state), "utf-8");

      const result = loadPetState();
      expect(result).toEqual(state);
    });

    it("returns null when file contains invalid JSON", () => {
      const storagePath = getTestStoragePath();
      fs.writeFileSync(storagePath, "not valid json {{{", "utf-8");

      const result = loadPetState();
      expect(result).toBeNull();
    });

    it("returns null when file contains valid JSON but invalid PetState", () => {
      const storagePath = getTestStoragePath();
      fs.writeFileSync(storagePath, JSON.stringify({ hello: "world" }), "utf-8");

      const result = loadPetState();
      expect(result).toBeNull();
    });

    it("returns null when file contains PetState with out-of-range stats", () => {
      const state = createValidPetState({ hunger: 150 });
      const storagePath = getTestStoragePath();
      fs.writeFileSync(storagePath, JSON.stringify(state), "utf-8");

      const result = loadPetState();
      expect(result).toBeNull();
    });
  });

  describe("savePetState", () => {
    it("saves valid PetState and returns true", () => {
      const state = createValidPetState();
      const result = savePetState(state);

      expect(result).toBe(true);

      const storagePath = getTestStoragePath();
      const raw = fs.readFileSync(storagePath, "utf-8");
      const loaded = JSON.parse(raw);
      expect(loaded).toEqual(state);
    });

    it("overwrites existing file with new state", () => {
      const state1 = createValidPetState({ name: "First" });
      const state2 = createValidPetState({ name: "Second" });

      savePetState(state1);
      savePetState(state2);

      const storagePath = getTestStoragePath();
      const raw = fs.readFileSync(storagePath, "utf-8");
      const loaded = JSON.parse(raw);
      expect(loaded.name).toBe("Second");
    });

    it("does not leave temp file on success", () => {
      const state = createValidPetState();
      savePetState(state);

      const tempPath = getTestStoragePath() + ".tmp";
      expect(fs.existsSync(tempPath)).toBe(false);
    });
  });

  describe("clearPetState", () => {
    it("returns true when file does not exist", () => {
      const result = clearPetState();
      expect(result).toBe(true);
    });

    it("deletes existing file and returns true", () => {
      const state = createValidPetState();
      savePetState(state);

      const storagePath = getTestStoragePath();
      expect(fs.existsSync(storagePath)).toBe(true);

      const result = clearPetState();
      expect(result).toBe(true);
      expect(fs.existsSync(storagePath)).toBe(false);
    });

    it("loadPetState returns null after clear", () => {
      const state = createValidPetState();
      savePetState(state);
      clearPetState();

      const result = loadPetState();
      expect(result).toBeNull();
    });
  });
});
