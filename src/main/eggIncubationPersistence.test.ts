/**
 * Bug Condition Exploration Test: Egg Incubation State Lost on Remount/Restart
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 *
 * This test encodes the EXPECTED behavior: after starting incubation on an egg,
 * saving game state, and reloading (simulating restart), the egg should retain
 * its incubation state (status, incubationStartedAt, hatchesAt).
 *
 * On UNFIXED code, this test FAILS — proving the bug exists because incubation
 * fields are not persisted to the Egg interface or restored on load.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import fs from "fs";
import path from "path";
import os from "os";

// We need to mock `electron` app.getPath since petStorage uses it
// Create a temp directory for test persistence
let tempDir: string;

// Mock electron's app module before importing petStorage
import { vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getPath: (key: string) => {
      // Return the temp directory for userData
      return tempDir;
    },
  },
}));

import {
  loadGameState,
  saveGameState,
  EGG_HATCH_HOURS,
  type Egg,
  type GameState,
} from "./petStorage";

describe("Bug Condition Exploration: Incubation State Lost on Remount/Restart", () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "petmii-test-"));
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Arbitrary for generating valid egg species
  const speciesArb = fc.constantFrom("blob" as const, "frog" as const);

  // Arbitrary for generating a "found" egg that a user would start incubating
  const foundEggArb = fc.record({
    id: fc.uuid(),
    species: speciesArb,
    isShiny: fc.boolean(),
    foundAt: fc.date({ min: new Date("2024-01-01"), max: new Date("2025-01-01") })
      .map((d) => d.toISOString()),
    hatchAt: fc.date({ min: new Date("2025-01-01"), max: new Date("2026-01-01") })
      .map((d) => d.toISOString()),
    foundBy: fc.oneof(fc.constant("mercy"), fc.uuid()),
  });

  /**
   * Simulates what handleStartIncubation SHOULD do:
   * Sets incubation fields on the egg and saves to game state.
   *
   * On unfixed code, these fields don't exist on the Egg interface and aren't
   * persisted by the save/load cycle in a meaningful way (the component-local
   * Set<string> is what actually tracks incubation, and it's lost on unmount).
   */
  function simulateStartIncubation(egg: Egg): Egg & {
    status: "incubating";
    incubationStartedAt: string;
    incubationDurationMs: number;
    hatchesAt: string;
  } {
    const durationMs = EGG_HATCH_HOURS[egg.species] * 60 * 60 * 1000;
    const now = Date.now();
    return {
      ...egg,
      status: "incubating" as const,
      incubationStartedAt: new Date(now).toISOString(),
      incubationDurationMs: durationMs,
      hatchesAt: new Date(now + durationMs).toISOString(),
    };
  }

  /**
   * Property 1: Incubation State Survives the Fixed App Flow
   *
   * **Validates: Requirements 1.1, 1.2**
   *
   * This test simulates the FIXED flow: the user clicks "Incubate" and the app
   * persists incubation fields (status, incubationStartedAt, incubationDurationMs,
   * hatchesAt) to the game state via updateEgg/saveGameState.
   * After reload, the egg should retain status === "incubating" with valid timestamps.
   *
   * On UNFIXED code, the Egg interface doesn't have these fields and they wouldn't
   * survive a save/load cycle. On FIXED code, they are properly persisted.
   */
  it("Property: egg retains incubation status after actual app save/reload flow", () => {
    fc.assert(
      fc.property(foundEggArb, (baseEgg) => {
        // 1. Simulate the FIXED handleStartIncubation: persist incubation fields
        const incubatingEgg = simulateStartIncubation(baseEgg);

        // 2. Save game state with the incubating egg (as the fixed code would do)
        const gameState: GameState = {
          pets: [],
          eggs: [incubatingEgg as unknown as Egg],
          graveyard: [],
          settings: { overlayPets: [], petScale: 1.5 },
        };
        saveGameState(gameState);

        // 3. Reload game state (simulating tab switch or app restart)
        const reloaded = loadGameState();
        const reloadedEgg = reloaded.eggs.find((e) => e.id === baseEgg.id);

        expect(reloadedEgg).toBeDefined();

        // 4. After reload, the egg should retain its incubation state
        const eggWithStatus = reloadedEgg as Egg & {
          status?: string;
          incubationStartedAt?: string;
          hatchesAt?: string;
        };

        // EXPECTED: status === "incubating" because the egg's hatchesAt is in the future
        expect(eggWithStatus.status).toBe("incubating");
        expect(eggWithStatus.incubationStartedAt).toBeDefined();
        expect(eggWithStatus.hatchesAt).toBeDefined();
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2: Bug Condition - Elapsed Incubation Normalizes to readyToHatch
   *
   * **Validates: Requirements 1.4**
   *
   * For any egg where incubation duration has elapsed and state is reloaded,
   * the egg MUST normalize to status === "readyToHatch".
   */
  it("Property: elapsed incubation normalizes to readyToHatch after reload", () => {
    fc.assert(
      fc.property(foundEggArb, (baseEgg) => {
        // 1. Create an egg that was incubated in the PAST (duration already elapsed)
        const durationMs = EGG_HATCH_HOURS[baseEgg.species] * 60 * 60 * 1000;
        const startedAt = Date.now() - durationMs - 60000; // started more than durationMs ago
        const hatchesAt = startedAt + durationMs; // hatch time is in the past

        const incubatingEgg = {
          ...baseEgg,
          status: "incubating" as const,
          incubationStartedAt: new Date(startedAt).toISOString(),
          incubationDurationMs: durationMs,
          hatchesAt: new Date(hatchesAt).toISOString(),
        };

        // 2. Save game state
        const gameState: GameState = {
          pets: [],
          eggs: [incubatingEgg as unknown as Egg],
          graveyard: [],
          settings: { overlayPets: [], petScale: 1.5 },
        };
        saveGameState(gameState);

        // 3. Reload game state (simulating app restart after incubation completed)
        const reloaded = loadGameState();
        const reloadedEgg = reloaded.eggs.find((e) => e.id === baseEgg.id);

        expect(reloadedEgg).toBeDefined();

        const eggWithStatus = reloadedEgg as Egg & { status?: string };

        // BUG: On unfixed code, loadGameState() has no normalization logic.
        // It doesn't check if Date.now() >= hatchesAt and flip status to "readyToHatch".
        // The egg will still have status "incubating" (if the field even survived)
        // instead of being normalized to "readyToHatch".
        expect(eggWithStatus.status).toBe("readyToHatch");
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 3: Multiple Eggs Retain Independent State After Reload
   *
   * **Validates: Requirements 1.3**
   *
   * For any set of eggs where multiple are incubating independently,
   * after save/reload (simulating tab switch), each egg MUST retain its
   * own incubation state. The FIXED code persists incubation fields via
   * updateEgg/saveGameState so they survive the reload.
   */
  it("Property: multiple eggs retain independent incubation state after reload", () => {
    const multipleEggsArb = fc.tuple(foundEggArb, foundEggArb).filter(
      ([a, b]) => a.id !== b.id
    );

    fc.assert(
      fc.property(multipleEggsArb, ([egg1, egg2]) => {
        // 1. Simulate the FIXED handleStartIncubation on both eggs
        const incubatingEgg1 = simulateStartIncubation(egg1);
        const incubatingEgg2 = simulateStartIncubation(egg2);

        // 2. Save game state with both incubating eggs (as the fixed code would do)
        const gameState: GameState = {
          pets: [],
          eggs: [incubatingEgg1 as unknown as Egg, incubatingEgg2 as unknown as Egg],
          graveyard: [],
          settings: { overlayPets: [], petScale: 1.5 },
        };
        saveGameState(gameState);

        // 3. Reload game state (simulating tab switch / component unmount)
        const reloaded = loadGameState();
        const reloadedEgg1 = reloaded.eggs.find((e) => e.id === egg1.id);
        const reloadedEgg2 = reloaded.eggs.find((e) => e.id === egg2.id);

        expect(reloadedEgg1).toBeDefined();
        expect(reloadedEgg2).toBeDefined();

        const egg1WithStatus = reloadedEgg1 as Egg & {
          status?: string;
          incubationStartedAt?: string;
          hatchesAt?: string;
        };
        const egg2WithStatus = reloadedEgg2 as Egg & {
          status?: string;
          incubationStartedAt?: string;
          hatchesAt?: string;
        };

        // EXPECTED: Both eggs retain status "incubating" with valid fields
        expect(egg1WithStatus.status).toBe("incubating");
        expect(egg1WithStatus.incubationStartedAt).toBeDefined();
        expect(egg1WithStatus.hatchesAt).toBeDefined();

        expect(egg2WithStatus.status).toBe("incubating");
        expect(egg2WithStatus.incubationStartedAt).toBeDefined();
        expect(egg2WithStatus.hatchesAt).toBeDefined();
      }),
      { numRuns: 30 }
    );
  });
});
