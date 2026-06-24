// src/main/cooldownMigration.test.ts
// Unit tests for actionCooldowns migration via loadGameState/saveGameState.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import type { PetState } from "../renderer/pet/petVariant";

const TEST_DIR = path.join(os.tmpdir(), "petmii-cooldown-migration-test-" + process.pid);

// Mock electron's app module before importing the module under test
vi.mock("electron", () => ({
  app: {
    getPath: () => TEST_DIR,
  },
}));

// Import after mock setup
import { loadGameState, saveGameState, type GameState } from "./petStorage";

function createCompletePet(overrides: Partial<PetState> = {}): PetState {
  return {
    id: "migration-test-pet",
    name: "TestPet",
    species: "blob",
    color: "yellow",
    personality: "sweet",
    isShiny: false,
    hunger: 60,
    happiness: 70,
    energy: 80,
    cleanliness: 85,
    bond: 30,
    hp: 100,
    isAlive: true,
    mood: "happy",
    lifeStage: "child",
    lastMessage: "Hello!",
    lastFedAt: "2024-01-01T12:00:00.000Z",
    lastPlayedAt: "2024-01-01T11:00:00.000Z",
    lastCleanedAt: "2024-01-01T10:00:00.000Z",
    lastRestedAt: null,
    hatchedAt: "2024-01-01T00:00:00.000Z",
    diedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T12:00:00.000Z",
    careHistory: {
      lifetime: { feed: 5, play: 3, rest: 2, clean: 4, pickedUp: 1, throw: 0, gentleThrow: 0, hardThrow: 0 },
      perStage: {
        baby: { feed: 2, play: 1, rest: 1, clean: 2, pickedUp: 1, throw: 0, gentleThrow: 0, hardThrow: 0 },
        child: { feed: 3, play: 2, rest: 1, clean: 2, pickedUp: 0, throw: 0, gentleThrow: 0, hardThrow: 0 },
        adult: { feed: 0, play: 0, rest: 0, clean: 0, pickedUp: 0, throw: 0, gentleThrow: 0, hardThrow: 0 },
      },
      metadata: { pickedUpLastCountedAt: null },
    },
    adultTrait: undefined,
    ...overrides,
  } as PetState;
}

function getGameStatePath(): string {
  return path.join(TEST_DIR, "game-state.json");
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

function writeRawGameState(state: unknown): void {
  const storagePath = getGameStatePath();
  fs.writeFileSync(storagePath, JSON.stringify(state, null, 2), "utf-8");
}

describe("cooldown migration (migratePetCareFields)", () => {
  beforeEach(() => {
    ensureTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  describe("round-trip", () => {
    it("preserves valid actionCooldowns through save and reload", () => {
      const cooldowns = {
        feed: Date.now() + 300000,
        play: Date.now() + 600000,
      };

      const pet = createCompletePet({ actionCooldowns: cooldowns });
      const gameState: GameState = {
        pets: [pet],
        eggs: [],
        graveyard: [],
        settings: { overlayPets: [pet.id], petScale: 1.5 },
      };

      // Save to disk
      const saved = saveGameState(gameState);
      expect(saved).toBe(true);

      // Reload from disk (triggers migration/sanitization)
      const loaded = loadGameState();
      expect(loaded.pets).toHaveLength(1);
      expect(loaded.pets[0].actionCooldowns).toEqual(cooldowns);
    });
  });

  describe("field preservation", () => {
    it("adds empty actionCooldowns without modifying any existing fields", () => {
      // Create a pet object WITHOUT actionCooldowns field
      const pet = createCompletePet();
      // Explicitly remove actionCooldowns to simulate old data
      const petWithoutCooldowns = { ...pet } as Record<string, unknown>;
      delete petWithoutCooldowns.actionCooldowns;

      const rawState = {
        pets: [petWithoutCooldowns],
        eggs: [],
        graveyard: [],
        settings: { overlayPets: ["migration-test-pet"], petScale: 1.5 },
      };

      // Write raw JSON to disk (bypassing saveGameState to avoid any runtime processing)
      writeRawGameState(rawState);

      // Load triggers migratePetCareFields
      const loaded = loadGameState();
      expect(loaded.pets).toHaveLength(1);

      const loadedPet = loaded.pets[0];

      // Verify actionCooldowns was added as empty object
      expect(loadedPet.actionCooldowns).toEqual({});

      // Verify all original fields are preserved
      expect(loadedPet.id).toBe("migration-test-pet");
      expect(loadedPet.name).toBe("TestPet");
      expect(loadedPet.species).toBe("blob");
      expect(loadedPet.color).toBe("yellow");
      expect(loadedPet.personality).toBe("sweet");
      expect(loadedPet.isShiny).toBe(false);
      expect(loadedPet.hunger).toBe(60);
      expect(loadedPet.happiness).toBe(70);
      expect(loadedPet.energy).toBe(80);
      expect(loadedPet.cleanliness).toBe(85);
      expect(loadedPet.bond).toBe(30);
      expect(loadedPet.hp).toBe(100);
      expect(loadedPet.isAlive).toBe(true);
      expect(loadedPet.mood).toBe("happy");
      expect(loadedPet.lifeStage).toBe("child");
      expect(loadedPet.hatchedAt).toBe("2024-01-01T00:00:00.000Z");
      expect(loadedPet.createdAt).toBe("2024-01-01T00:00:00.000Z");
      expect(loadedPet.updatedAt).toBe("2024-01-01T12:00:00.000Z");
      expect(loadedPet.careHistory).toEqual(pet.careHistory);
      expect(loadedPet.adultTrait).toBeUndefined();
    });
  });

  describe("invalid cleanup", () => {
    it("removes invalid cooldown entries but preserves valid ones", () => {
      const validTimestamp = 1700000000000; // valid future-ish timestamp

      // Create pet with actionCooldowns containing invalid values
      const petWithBadCooldowns = createCompletePet();
      const rawPet = { ...petWithBadCooldowns } as Record<string, unknown>;
      rawPet.actionCooldowns = {
        feed: NaN,
        play: -5,
        rest: "hello",
        clean: validTimestamp,
      };

      const rawState = {
        pets: [rawPet],
        eggs: [],
        graveyard: [],
        settings: { overlayPets: ["migration-test-pet"], petScale: 1.5 },
      };

      // Write raw JSON to disk
      writeRawGameState(rawState);

      // Load triggers migratePetCareFields → sanitizeCooldowns
      const loaded = loadGameState();
      expect(loaded.pets).toHaveLength(1);

      const loadedCooldowns = loaded.pets[0].actionCooldowns;

      // NaN is not serializable via JSON, so it becomes null in the file.
      // -5 is negative → removed by sanitizeCooldowns
      // "hello" is not a number → removed by sanitizeCooldowns
      // 1700000000000 is a valid positive finite number → preserved
      expect(loadedCooldowns).toEqual({ clean: validTimestamp });
    });
  });
});
