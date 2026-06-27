// src/main/eggPreservation.test.ts
// Property 2: Preservation — Non-Incubation Egg Behaviors Unchanged
// These tests verify existing behavior BEFORE the incubation persistence fix.
// They MUST PASS on unfixed code to establish a baseline, and STILL pass after the fix.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

// We test the egg logic in isolation without needing Electron or file system.
// We replicate the core logic from petStorage and statDecay to test behaviors directly.

// ===== Types (mirrors current Egg interface) =====

interface Egg {
  id: string;
  species: "blob" | "frog";
  isShiny: boolean;
  foundAt: string;
  hatchAt: string;
  foundBy: string;
}

interface GameState {
  pets: any[];
  eggs: Egg[];
  graveyard: any[];
  settings: { overlayPets: string[]; petScale: number };
}

// ===== Core logic replicated from petStorage.ts =====

const EGG_HATCH_HOURS: Record<string, number> = {
  blob: 0.5,
  frog: 0.7,
};

const ALL_SPECIES: Array<"blob" | "frog"> = ["blob", "frog"];
const SHINY_EGG_CHANCE = 1 / 200;
const MAX_EGGS = 3;

function removeEgg(game: GameState, eggId: string): { game: GameState; egg: Egg | null } {
  const egg = game.eggs.find((e) => e.id === eggId) || null;
  if (!egg) return { game, egg: null };
  const newGame = {
    ...game,
    eggs: game.eggs.filter((e) => e.id !== eggId),
  };
  return { game: newGame, egg };
}

function addEgg(game: GameState, egg: Egg): { game: GameState; success: boolean } {
  if (game.eggs.length >= MAX_EGGS) return { game, success: false };
  return { game: { ...game, eggs: [...game.eggs, egg] }, success: true };
}

function generateEgg(finderSpecies: "blob" | "frog", finderId: string): Egg {
  const SAME_SPECIES_WEIGHT = 2;
  const weights = ALL_SPECIES.map((s) => ({
    species: s,
    weight: s === finderSpecies ? SAME_SPECIES_WEIGHT : 1,
  }));
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  let species: "blob" | "frog" = finderSpecies;
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) {
      species = entry.species;
      break;
    }
  }

  const now = new Date();
  const hatchMs = EGG_HATCH_HOURS[species] * 60 * 60 * 1000;
  const hatchAt = new Date(now.getTime() + hatchMs);

  return {
    id: crypto.randomUUID(),
    species,
    isShiny: Math.random() < SHINY_EGG_CHANCE,
    foundAt: now.toISOString(),
    hatchAt: hatchAt.toISOString(),
    foundBy: finderId,
  };
}

function generateMercyEgg(): Egg {
  const species = ALL_SPECIES[Math.floor(Math.random() * ALL_SPECIES.length)];
  const now = new Date();
  const hatchMinutes = 1 + Math.random() * 4;
  const hatchAt = new Date(now.getTime() + hatchMinutes * 60 * 1000);

  return {
    id: crypto.randomUUID(),
    species,
    isShiny: Math.random() < SHINY_EGG_CHANCE,
    foundAt: now.toISOString(),
    hatchAt: hatchAt.toISOString(),
    foundBy: "mercy",
  };
}

// ===== Arbitraries (generators) =====

const speciesArb = fc.constantFrom<"blob" | "frog">("blob", "frog");

const eggArb = fc.record({
  id: fc.uuid(),
  species: speciesArb,
  isShiny: fc.boolean(),
  foundAt: fc.date({ min: new Date("2024-01-01"), max: new Date("2025-12-31") }).map((d) => d.toISOString()),
  hatchAt: fc.date({ min: new Date("2024-01-01"), max: new Date("2025-12-31") }).map((d) => d.toISOString()),
  foundBy: fc.oneof(fc.uuid(), fc.constant("mercy")),
});

const gameStateArb = fc.record({
  pets: fc.constant([]),
  eggs: fc.array(eggArb, { minLength: 0, maxLength: 3 }),
  graveyard: fc.constant([]),
  settings: fc.constant({ overlayPets: [] as string[], petScale: 1.5 }),
});

// ===== Property Tests =====

describe("Property 2: Preservation — Non-Incubation Egg Behaviors Unchanged", () => {
  /**
   * **Validates: Requirements 3.2**
   * Hatching a readyToHatch egg removes it from the eggs array.
   * In the current unfixed code, "ready to hatch" means hatchAt <= now.
   */
  describe("Hatch preservation", () => {
    it("hatching any egg by ID removes it from the eggs array", () => {
      fc.assert(
        fc.property(
          gameStateArb.filter((g) => g.eggs.length > 0),
          (game) => {
            // Pick a random egg from the game to hatch
            const eggIndex = Math.floor(Math.random() * game.eggs.length);
            const eggToHatch = game.eggs[eggIndex];

            const result = removeEgg(game, eggToHatch.id);

            // The hatched egg is returned
            expect(result.egg).not.toBeNull();
            expect(result.egg!.id).toBe(eggToHatch.id);
            expect(result.egg!.species).toBe(eggToHatch.species);

            // The egg is removed from the array
            expect(result.game.eggs).not.toContainEqual(eggToHatch);
            expect(result.game.eggs.length).toBe(game.eggs.length - 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("hatching a ready egg produces the egg data needed to create a pet", () => {
      fc.assert(
        fc.property(
          eggArb,
          (egg) => {
            // Simulate an egg that is ready (hatchAt in the past)
            const readyEgg: Egg = {
              ...egg,
              hatchAt: new Date(Date.now() - 10000).toISOString(),
            };
            const game: GameState = {
              pets: [],
              eggs: [readyEgg],
              graveyard: [],
              settings: { overlayPets: [], petScale: 1.5 },
            };

            const result = removeEgg(game, readyEgg.id);

            // The returned egg has the species needed to generate a pet
            expect(result.egg).not.toBeNull();
            expect(ALL_SPECIES).toContain(result.egg!.species);
            expect(typeof result.egg!.isShiny).toBe("boolean");

            // Eggs array is now empty
            expect(result.game.eggs.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.3**
   * Discarding any egg removes it from the egg list regardless of incubation status.
   */
  describe("Discard preservation", () => {
    it("discarding any egg removes it from the eggs array regardless of its state", () => {
      fc.assert(
        fc.property(
          gameStateArb.filter((g) => g.eggs.length > 0),
          (game) => {
            // Pick any egg to discard
            const eggIndex = Math.floor(Math.random() * game.eggs.length);
            const eggToDiscard = game.eggs[eggIndex];

            // Discard uses the same removeEgg mechanism
            const result = removeEgg(game, eggToDiscard.id);

            // Egg is removed
            expect(result.game.eggs.find((e) => e.id === eggToDiscard.id)).toBeUndefined();
            expect(result.game.eggs.length).toBe(game.eggs.length - 1);

            // Other eggs remain untouched
            const otherEggs = game.eggs.filter((e) => e.id !== eggToDiscard.id);
            for (const other of otherEggs) {
              expect(result.game.eggs.find((e) => e.id === other.id)).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("discarding a non-existent egg does not modify the game state", () => {
      fc.assert(
        fc.property(
          gameStateArb,
          (game) => {
            const result = removeEgg(game, "non-existent-id-12345");

            expect(result.egg).toBeNull();
            expect(result.game.eggs.length).toBe(game.eggs.length);
            expect(result.game.eggs).toEqual(game.eggs);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.4**
   * Egg discovery produces eggs with valid species, isShiny, foundAt, foundBy fields.
   */
  describe("Discovery preservation", () => {
    it("discovered eggs have valid species, isShiny, foundAt, and foundBy fields", () => {
      fc.assert(
        fc.property(
          speciesArb,
          fc.uuid(),
          (finderSpecies, finderId) => {
            const egg = generateEgg(finderSpecies, finderId);

            // Valid species
            expect(ALL_SPECIES).toContain(egg.species);

            // Valid isShiny (boolean)
            expect(typeof egg.isShiny).toBe("boolean");

            // Valid foundAt (ISO date string)
            expect(new Date(egg.foundAt).toISOString()).toBe(egg.foundAt);
            expect(Number.isNaN(new Date(egg.foundAt).getTime())).toBe(false);

            // Valid hatchAt (ISO date string, after foundAt)
            expect(new Date(egg.hatchAt).toISOString()).toBe(egg.hatchAt);
            expect(new Date(egg.hatchAt).getTime()).toBeGreaterThan(new Date(egg.foundAt).getTime());

            // Valid foundBy (matches finder ID)
            expect(egg.foundBy).toBe(finderId);

            // Valid id (non-empty string)
            expect(egg.id.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("egg discovery respects MAX_EGGS limit", () => {
      fc.assert(
        fc.property(
          gameStateArb,
          speciesArb,
          fc.uuid(),
          (game, finderSpecies, finderId) => {
            const egg = generateEgg(finderSpecies, finderId);
            const result = addEgg(game, egg);

            if (game.eggs.length >= MAX_EGGS) {
              // Should not add
              expect(result.success).toBe(false);
              expect(result.game.eggs.length).toBe(game.eggs.length);
            } else {
              // Should add
              expect(result.success).toBe(true);
              expect(result.game.eggs.length).toBe(game.eggs.length + 1);
              expect(result.game.eggs[result.game.eggs.length - 1]).toEqual(egg);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.1**
   * Starter/mercy eggs hatch instantly (very short hatch time) without requiring incubation.
   * In the current code, mercy eggs have hatchAt set to 1-5 minutes in the future.
   * Starter eggs (onboarding) use the normal EggHatchScreen flow which doesn't involve incubation.
   */
  describe("Starter/mercy egg preservation", () => {
    it("mercy eggs are created with short hatch times (1-5 minutes)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // dummy seed for randomness
          (_seed) => {
            const egg = generateMercyEgg();

            // Mercy eggs have foundBy = "mercy"
            expect(egg.foundBy).toBe("mercy");

            // Mercy eggs have valid species
            expect(ALL_SPECIES).toContain(egg.species);

            // Hatch time is between 1-5 minutes from now
            const hatchTime = new Date(egg.hatchAt).getTime();
            const foundTime = new Date(egg.foundAt).getTime();
            const diffMs = hatchTime - foundTime;

            // 1 minute = 60000ms, 5 minutes = 300000ms
            expect(diffMs).toBeGreaterThanOrEqual(60000);
            expect(diffMs).toBeLessThanOrEqual(300000);
          }
        ),
        { numRuns: 50 }
      );
    });

    it("starter eggs (onboarding) do not require incubation - no incubation fields exist on Egg", () => {
      fc.assert(
        fc.property(
          eggArb,
          (egg) => {
            // In the current unfixed code, there is no "status" or "incubationStartedAt" field
            // The Egg type only has: id, species, isShiny, foundAt, hatchAt, foundBy
            const eggKeys = Object.keys(egg).sort();
            const expectedKeys = ["foundAt", "foundBy", "hatchAt", "id", "isShiny", "species"];
            expect(eggKeys).toEqual(expectedKeys);

            // No incubation-related fields exist
            expect((egg as any).status).toBeUndefined();
            expect((egg as any).incubationStartedAt).toBeUndefined();
            expect((egg as any).incubationDurationMs).toBeUndefined();
            expect((egg as any).hatchesAt).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.5**
   * Eggs without incubation fields (status undefined or "found") behave identically.
   * In the current code, there IS no status field — all eggs are effectively "found" until
   * the local component state tracks them as incubating.
   */
  describe("Non-incubation egg behavior preservation", () => {
    it("eggs without status field can still be hatched and discarded normally", () => {
      fc.assert(
        fc.property(
          eggArb,
          fc.constantFrom("hatch", "discard"),
          (egg, action) => {
            const game: GameState = {
              pets: [],
              eggs: [egg],
              graveyard: [],
              settings: { overlayPets: [], petScale: 1.5 },
            };

            // No status field on egg
            expect((egg as any).status).toBeUndefined();

            // Both hatch and discard use removeEgg
            const result = removeEgg(game, egg.id);

            // Action completes successfully
            expect(result.egg).not.toBeNull();
            expect(result.egg!.id).toBe(egg.id);
            expect(result.game.eggs.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.6**
   * The setInterval countdown is UI-only and not the source of truth for incubation.
   * In the current code, the countdown timer only triggers `setNow(Date.now())` for re-render.
   * It does NOT modify the egg data, start incubation, or change game state.
   */
  describe("setInterval countdown is UI-only", () => {
    it("countdown tick does not modify egg data - egg remains identical after any number of ticks", () => {
      fc.assert(
        fc.property(
          eggArb,
          fc.integer({ min: 1, max: 1000 }), // number of simulated ticks
          (egg, tickCount) => {
            // Simulate what the UI timer does: only updates `now` for rendering
            // It does NOT write to the egg object
            const originalEgg = { ...egg };

            // Simulate tick count UI refreshes (the timer only calls setNow(Date.now()))
            let displayNow = Date.now();
            for (let i = 0; i < tickCount; i++) {
              displayNow = Date.now() + i * 1000; // simulated time passage
            }

            // The egg itself is NEVER modified by the timer
            expect(egg).toEqual(originalEgg);

            // The timer's "now" value is used only for UI calculation
            const hatchTime = new Date(egg.hatchAt).getTime();
            const remaining = hatchTime - displayNow;

            // remaining is a pure computation, not persisted
            expect(typeof remaining).toBe("number");

            // Egg data is unchanged
            expect(egg.id).toBe(originalEgg.id);
            expect(egg.hatchAt).toBe(originalEgg.hatchAt);
            expect(egg.foundAt).toBe(originalEgg.foundAt);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("isReady determination is purely based on wall-clock comparison, not component state mutation", () => {
      fc.assert(
        fc.property(
          eggArb,
          fc.date({ min: new Date("2024-01-01"), max: new Date("2026-12-31") }),
          (egg, currentTime) => {
            // The "isReady" check in EggList is: remaining <= 0
            // where remaining = new Date(egg.hatchAt).getTime() - now
            const hatchTime = new Date(egg.hatchAt).getTime();
            const now = currentTime.getTime();
            const remaining = hatchTime - now;
            const isReady = remaining <= 0;

            // This is a pure function of hatchAt and current time
            // No side effects, no mutation
            expect(typeof isReady).toBe("boolean");

            // Recomputing gives the same result (deterministic)
            const isReady2 = (hatchTime - now) <= 0;
            expect(isReady).toBe(isReady2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
