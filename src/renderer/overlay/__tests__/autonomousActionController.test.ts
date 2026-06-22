/**
 * Unit tests for AutonomousActionController (Task 5.1).
 *
 * Verifies:
 * - Controller creation and destruction lifecycle
 * - Tick behavior with empty pets
 * - Eligibility checks for rest and play
 * - Nighttime detection and probability computation
 * - Facing directions and effect position computation
 * - Pair selection for play
 * - Notification callbacks recording cooldowns
 * - Tick dispatches for autonomousRest and playTogether
 * - Duration timer expiry calling end callbacks
 * - Interruption clearing timers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createAutonomousActionController,
  destroyAutonomousActionController,
  notifyAutonomousRestEnded,
  notifyPlayTogetherEnded,
  isNighttime,
  computeRestProbability,
  isEligibleForRest,
  isEligibleForPlay,
  computeFacingDirections,
  computeEffectPosition,
  selectPairForPlay,
  generatePlayDuration,
  AUTONOMOUS_TICK_INTERVAL_MS,
  AUTONOMOUS_REST_BASE_CHANCE,
  AUTONOMOUS_REST_NIGHT_MULTIPLIER,
  AUTONOMOUS_REST_COOLDOWN_MS,
  PLAY_TOGETHER_COOLDOWN_MS,
  PLAY_TOGETHER_BASE_CHANCE,
  AutonomousActionState,
  AutonomousActionDeps,
} from "../autonomousActionController";
import type { PetOverlayState } from "../../OverlayApp";

// ─── Test Helpers ───

function createMockPet(overrides: Partial<PetOverlayState> = {}): PetOverlayState {
  return {
    id: "pet1",
    pet: {} as any,
    x: 100,
    y: 200,
    vx: 0,
    vy: 0,
    rotation: 0,
    angularVel: 0,
    direction: 1,
    currentAction: "idle",
    physicsState: "idle",
    visualState: "idle",
    lifecycleState: "normal",
    resolvedProfile: {} as any,
    restTimer: null,
    message: null,
    messageTimer: null,
    hasFoundEgg: false,
    isHovered: false,
    isLeaving: false,
    ...overrides,
  } as PetOverlayState;
}

function createMockDeps(overrides: Partial<AutonomousActionDeps> = {}): AutonomousActionDeps {
  return {
    getPets: () => [],
    getViewportWidth: () => 1920,
    getGroundY: () => 600,
    dispatchAutonomousRest: vi.fn(),
    endAutonomousRest: vi.fn(),
    dispatchPlayTogether: vi.fn(),
    endPlayTogether: vi.fn(),
    getCurrentHour: () => 12,
    ...overrides,
  };
}

// ─── Test Suite ───

describe("AutonomousActionController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // 1. Controller creation
  describe("createAutonomousActionController", () => {
    it("returns state with empty maps, null activePlaySession, and a non-null tickTimer", () => {
      const deps = createMockDeps();
      const state = createAutonomousActionController(deps);

      expect(state.tickTimer).not.toBeNull();
      expect(state.restCooldownExpiry.size).toBe(0);
      expect(state.playCooldownExpiry.size).toBe(0);
      expect(state.activeRest.size).toBe(0);
      expect(state.activePlaySession).toBeNull();

      destroyAutonomousActionController(state);
    });
  });

  // 2. Controller destruction
  describe("destroyAutonomousActionController", () => {
    it("clears tickTimer, all activeRest timers, activePlaySession timer, and all maps", () => {
      const deps = createMockDeps();
      const state = createAutonomousActionController(deps);

      // Simulate some active state
      const restTimer = setTimeout(() => {}, 10000);
      state.activeRest.set("pet1", restTimer);
      state.restCooldownExpiry.set("pet1", Date.now() + 100000);
      state.playCooldownExpiry.set("pet2", Date.now() + 100000);
      const playTimer = setTimeout(() => {}, 20000);
      state.activePlaySession = { petId1: "pet1", petId2: "pet2", durationTimer: playTimer };

      destroyAutonomousActionController(state);

      expect(state.tickTimer).toBeNull();
      expect(state.activeRest.size).toBe(0);
      expect(state.activePlaySession).toBeNull();
      expect(state.restCooldownExpiry.size).toBe(0);
      expect(state.playCooldownExpiry.size).toBe(0);
    });
  });

  // 3. Tick with empty pets
  describe("tick with empty pets", () => {
    it("does not dispatch any actions when getPets returns []", () => {
      const dispatchAutonomousRest = vi.fn();
      const dispatchPlayTogether = vi.fn();
      const deps = createMockDeps({ dispatchAutonomousRest, dispatchPlayTogether });
      const state = createAutonomousActionController(deps);

      vi.advanceTimersByTime(AUTONOMOUS_TICK_INTERVAL_MS);

      expect(dispatchAutonomousRest).not.toHaveBeenCalled();
      expect(dispatchPlayTogether).not.toHaveBeenCalled();

      destroyAutonomousActionController(state);
    });
  });

  // 4. isEligibleForRest
  describe("isEligibleForRest", () => {
    const now = Date.now();

    it("returns true when physicsState=idle, currentAction=idle, lifecycleState=normal, no cooldown", () => {
      const pet = createMockPet();
      expect(isEligibleForRest(pet, undefined, now)).toBe(true);
    });

    it("returns false when physicsState is not idle", () => {
      const pet = createMockPet({ physicsState: "dragging" });
      expect(isEligibleForRest(pet, undefined, now)).toBe(false);
    });

    it("returns false when currentAction is not idle", () => {
      const pet = createMockPet({ currentAction: "hop" });
      expect(isEligibleForRest(pet, undefined, now)).toBe(false);
    });

    it("returns false when lifecycleState is evolving", () => {
      const pet = createMockPet({ lifecycleState: "evolving" });
      expect(isEligibleForRest(pet, undefined, now)).toBe(false);
    });

    it("returns false when cooldown has not expired", () => {
      const pet = createMockPet();
      expect(isEligibleForRest(pet, now + 10000, now)).toBe(false);
    });

    it("returns true when cooldown has expired", () => {
      const pet = createMockPet();
      expect(isEligibleForRest(pet, now - 1, now)).toBe(true);
    });
  });

  // 5. isEligibleForPlay
  describe("isEligibleForPlay", () => {
    const now = Date.now();

    it("returns true when physicsState=idle, currentAction=idle, lifecycleState=normal, no cooldown", () => {
      const pet = createMockPet();
      expect(isEligibleForPlay(pet, undefined, now)).toBe(true);
    });

    it("returns false when physicsState is not idle", () => {
      const pet = createMockPet({ physicsState: "flying" });
      expect(isEligibleForPlay(pet, undefined, now)).toBe(false);
    });

    it("returns false when currentAction is not idle", () => {
      const pet = createMockPet({ currentAction: "rest" });
      expect(isEligibleForPlay(pet, undefined, now)).toBe(false);
    });

    it("returns false when lifecycleState is evolving", () => {
      const pet = createMockPet({ lifecycleState: "evolving" });
      expect(isEligibleForPlay(pet, undefined, now)).toBe(false);
    });

    it("returns false when cooldown has not expired", () => {
      const pet = createMockPet();
      expect(isEligibleForPlay(pet, now + 50000, now)).toBe(false);
    });

    it("returns true when cooldown has expired", () => {
      const pet = createMockPet();
      expect(isEligibleForPlay(pet, now - 1, now)).toBe(true);
    });
  });

  // 6. isNighttime
  describe("isNighttime", () => {
    it("returns true for hours 22, 23, 0, 1, 2, 3, 4, 5", () => {
      for (const hour of [22, 23, 0, 1, 2, 3, 4, 5]) {
        expect(isNighttime(hour)).toBe(true);
      }
    });

    it("returns false for hours 6 through 21", () => {
      for (let hour = 6; hour <= 21; hour++) {
        expect(isNighttime(hour)).toBe(false);
      }
    });
  });

  // 7. computeRestProbability
  describe("computeRestProbability", () => {
    it("returns base chance (0.05) for daytime hours", () => {
      expect(computeRestProbability(12)).toBe(AUTONOMOUS_REST_BASE_CHANCE);
      expect(computeRestProbability(6)).toBe(AUTONOMOUS_REST_BASE_CHANCE);
      expect(computeRestProbability(21)).toBe(AUTONOMOUS_REST_BASE_CHANCE);
    });

    it("returns base chance × night multiplier (0.15) for nighttime hours", () => {
      const expected = AUTONOMOUS_REST_BASE_CHANCE * AUTONOMOUS_REST_NIGHT_MULTIPLIER;
      expect(computeRestProbability(22)).toBe(expected);
      expect(computeRestProbability(0)).toBe(expected);
      expect(computeRestProbability(3)).toBe(expected);
    });
  });

  // 8. computeFacingDirections
  describe("computeFacingDirections", () => {
    it("first faces right, second faces left when x1 < x2", () => {
      expect(computeFacingDirections(100, 200)).toEqual({ dir1: 1, dir2: -1 });
    });

    it("first faces left, second faces right when x1 > x2", () => {
      expect(computeFacingDirections(300, 100)).toEqual({ dir1: -1, dir2: 1 });
    });

    it("first faces right, second faces left when x1 === x2", () => {
      expect(computeFacingDirections(150, 150)).toEqual({ dir1: 1, dir2: -1 });
    });
  });

  // 9. computeEffectPosition
  describe("computeEffectPosition", () => {
    it("returns midpoint of sprite centers", () => {
      // Pet1 at (100, 200), Pet2 at (300, 200), petSize = 48
      // Centers: (124, 224) and (324, 224)
      // Midpoint: (224, 224)
      const result = computeEffectPosition(100, 200, 300, 200, 48);
      expect(result.x).toBe((100 + 24 + 300 + 24) / 2);
      expect(result.y).toBe((200 + 24 + 200 + 24) / 2);
    });

    it("handles different Y positions", () => {
      const result = computeEffectPosition(0, 0, 100, 100, 50);
      // Centers: (25, 25) and (125, 125)
      // Midpoint: (75, 75)
      expect(result.x).toBe(75);
      expect(result.y).toBe(75);
    });
  });

  // 10. selectPairForPlay
  describe("selectPairForPlay", () => {
    it("returns 2 distinct IDs from the input array", () => {
      const ids = ["a", "b", "c", "d"];
      const [first, second] = selectPairForPlay(ids);
      expect(ids).toContain(first);
      expect(ids).toContain(second);
      expect(first).not.toBe(second);
    });

    it("works with exactly 2 IDs", () => {
      const ids = ["x", "y"];
      const [first, second] = selectPairForPlay(ids);
      expect(new Set([first, second])).toEqual(new Set(["x", "y"]));
    });
  });

  // 11. notifyAutonomousRestEnded
  describe("notifyAutonomousRestEnded", () => {
    it("removes from activeRest and sets cooldown expiry", () => {
      const deps = createMockDeps();
      const state = createAutonomousActionController(deps);

      const timer = setTimeout(() => {}, 10000);
      state.activeRest.set("pet1", timer);

      vi.setSystemTime(new Date(1000000));
      notifyAutonomousRestEnded(state, "pet1");

      expect(state.activeRest.has("pet1")).toBe(false);
      expect(state.restCooldownExpiry.get("pet1")).toBe(1000000 + AUTONOMOUS_REST_COOLDOWN_MS);

      destroyAutonomousActionController(state);
    });
  });

  // 12. notifyPlayTogetherEnded
  describe("notifyPlayTogetherEnded", () => {
    it("clears session and sets cooldown for both pets", () => {
      const deps = createMockDeps();
      const state = createAutonomousActionController(deps);

      const playTimer = setTimeout(() => {}, 20000);
      state.activePlaySession = { petId1: "pet1", petId2: "pet2", durationTimer: playTimer };

      vi.setSystemTime(new Date(2000000));
      notifyPlayTogetherEnded(state, "pet1", "pet2");

      expect(state.activePlaySession).toBeNull();
      expect(state.playCooldownExpiry.get("pet1")).toBe(2000000 + PLAY_TOGETHER_COOLDOWN_MS);
      expect(state.playCooldownExpiry.get("pet2")).toBe(2000000 + PLAY_TOGETHER_COOLDOWN_MS);

      destroyAutonomousActionController(state);
    });
  });

  // 13. Tick dispatches autonomousRest
  describe("tick dispatches autonomousRest", () => {
    it("calls dispatchAutonomousRest for eligible pet when Math.random returns 0", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const pet = createMockPet({ id: "pet1" });
      const dispatchAutonomousRest = vi.fn();
      const deps = createMockDeps({
        getPets: () => [pet],
        dispatchAutonomousRest,
        getCurrentHour: () => 12,
      });

      const state = createAutonomousActionController(deps);

      vi.advanceTimersByTime(AUTONOMOUS_TICK_INTERVAL_MS);

      expect(dispatchAutonomousRest).toHaveBeenCalledWith("pet1");

      destroyAutonomousActionController(state);
    });
  });

  // 14. Tick dispatches playTogether
  describe("tick dispatches playTogether", () => {
    it("calls dispatchPlayTogether when ≥2 eligible pets and Math.random returns 0", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const pet1 = createMockPet({ id: "petA" });
      const pet2 = createMockPet({ id: "petB" });
      const dispatchPlayTogether = vi.fn();
      const deps = createMockDeps({
        getPets: () => [pet1, pet2],
        dispatchPlayTogether,
        getCurrentHour: () => 12,
      });

      const state = createAutonomousActionController(deps);

      vi.advanceTimersByTime(AUTONOMOUS_TICK_INTERVAL_MS);

      expect(dispatchPlayTogether).toHaveBeenCalled();
      const [id1, id2] = dispatchPlayTogether.mock.calls[0];
      expect(new Set([id1, id2])).toEqual(new Set(["petA", "petB"]));

      destroyAutonomousActionController(state);
    });
  });

  // 15. Duration timer expiry
  describe("duration timer expiry", () => {
    it("calls endAutonomousRest when rest duration timer expires", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const pet = createMockPet({ id: "pet1" });
      const endAutonomousRest = vi.fn();
      const deps = createMockDeps({
        getPets: () => [pet],
        endAutonomousRest,
        dispatchAutonomousRest: vi.fn(),
        getCurrentHour: () => 12,
      });

      const state = createAutonomousActionController(deps);

      // Trigger the tick to dispatch autonomousRest
      vi.advanceTimersByTime(AUTONOMOUS_TICK_INTERVAL_MS);

      // Advance past the rest duration (30000ms)
      vi.advanceTimersByTime(30000);

      expect(endAutonomousRest).toHaveBeenCalledWith("pet1");

      destroyAutonomousActionController(state);
    });

    it("calls endPlayTogether when play duration timer expires", () => {
      // Mock random to return 0 for all rolls (triggers actions) and a small value for duration
      vi.spyOn(Math, "random").mockReturnValue(0);

      const pet1 = createMockPet({ id: "petA" });
      const pet2 = createMockPet({ id: "petB" });
      const endPlayTogether = vi.fn();
      const deps = createMockDeps({
        getPets: () => [pet1, pet2],
        endPlayTogether,
        dispatchPlayTogether: vi.fn(),
        getCurrentHour: () => 12,
      });

      const state = createAutonomousActionController(deps);

      // Trigger tick to dispatch playTogether
      vi.advanceTimersByTime(AUTONOMOUS_TICK_INTERVAL_MS);

      // Advance past the max play duration to ensure timer fires
      vi.advanceTimersByTime(60000);

      expect(endPlayTogether).toHaveBeenCalled();

      destroyAutonomousActionController(state);
    });
  });

  // 16. Interruption clears timer
  describe("interruption clears timer", () => {
    it("no callback fires after clearing the timer from controller state", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const pet = createMockPet({ id: "pet1" });
      const endAutonomousRest = vi.fn();
      const deps = createMockDeps({
        getPets: () => [pet],
        endAutonomousRest,
        dispatchAutonomousRest: vi.fn(),
        getCurrentHour: () => 12,
      });

      const state = createAutonomousActionController(deps);

      // Trigger tick to start autonomousRest
      vi.advanceTimersByTime(AUTONOMOUS_TICK_INTERVAL_MS);

      // Simulate interruption: clear the timer manually
      const timer = state.activeRest.get("pet1");
      expect(timer).toBeDefined();
      clearTimeout(timer!);
      state.activeRest.delete("pet1");

      // Advance past the rest duration — callback should NOT fire
      vi.advanceTimersByTime(30000);

      expect(endAutonomousRest).not.toHaveBeenCalled();

      destroyAutonomousActionController(state);
    });
  });
});
