/**
 * Unit tests for CursorAttractionController — proximity timer logic (Task 5.2).
 *
 * Verifies:
 * - Timer accumulation when pet is within radius and eligible
 * - Timer reset when cursor exits radius
 * - Timer trigger at MOUSE_ATTRACT_DELAY_MS with re-evaluation
 * - Timer reset when pet transitions to ineligible
 * - All timers reset when cursor position is null
 * - Active pet approach cancellation when cursor exits radius (Req 8.5)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createCursorAttractionController,
  destroyCursorAttractionController,
  notifyApproachEnded,
  CursorAttractionState,
  CursorAttractionDeps,
  MOUSE_ATTRACT_RADIUS,
  MOUSE_ATTRACT_DELAY_MS,
  MOUSE_ATTRACT_COOLDOWN_MS,
  MOUSE_ATTRACT_MAX_PETS,
} from "../cursorAttractionController";
import type { PetOverlayState } from "../../OverlayApp";
import type { MovementProfile } from "../movementProfiles";

// ─── Test Helpers ───

function makeProfile(overrides: Partial<MovementProfile> = {}): MovementProfile {
  return {
    actionType: "hop",
    movementStyle: "grounded",
    eligibleActions: ["hop"],
    stepDistance: 80,
    hopHeight: 25,
    duration: 500,
    interval: 3000,
    landingPauseMs: 0,
    hoverOffsetY: 0,
    groundOffsetY: 0,
    actionWeights: { hop: 4 },
    ...overrides,
  };
}

function makePet(overrides: Partial<PetOverlayState> = {}): PetOverlayState {
  return {
    id: "pet-1",
    pet: {} as any,
    x: 100,
    y: 400,
    vx: 0,
    vy: 0,
    rotation: 0,
    angularVel: 0,
    direction: 1,
    currentAction: "idle",
    physicsState: "idle",
    visualState: "idle",
    lifecycleState: "normal",
    resolvedProfile: makeProfile(),
    restTimer: null,
    message: null,
    messageTimer: null,
    hasFoundEgg: false,
    isHovered: false,
    isLeaving: false,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<CursorAttractionDeps> = {}): CursorAttractionDeps {
  return {
    getCursorPos: () => ({ x: 136, y: 436 }), // center of pet at (100, 400) with size 72
    getPets: () => [makePet()],
    getViewportWidth: () => 1920,
    getGroundY: () => 500,
    dispatchApproach: vi.fn(),
    cancelApproach: vi.fn(),
    ...overrides,
  };
}

const TICK_INTERVAL_MS = 200; // Internal constant, matches module

describe("cursorAttractionController — proximity timer logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("timer accumulation", () => {
    it("increments proximityTimer by TICK_INTERVAL_MS when pet is within radius and eligible", () => {
      const deps = makeDeps();
      const state = createCursorAttractionController(deps);

      // After one tick
      vi.advanceTimersByTime(TICK_INTERVAL_MS);
      expect(state.proximityTimers.get("pet-1")).toBe(TICK_INTERVAL_MS);

      // After two ticks
      vi.advanceTimersByTime(TICK_INTERVAL_MS);
      expect(state.proximityTimers.get("pet-1")).toBe(TICK_INTERVAL_MS * 2);

      destroyCursorAttractionController(state);
    });

    it("accumulates timer across multiple ticks without resetting", () => {
      const deps = makeDeps();
      const state = createCursorAttractionController(deps);

      // Advance 5 ticks (1000ms total)
      vi.advanceTimersByTime(TICK_INTERVAL_MS * 5);
      expect(state.proximityTimers.get("pet-1")).toBe(1000);

      destroyCursorAttractionController(state);
    });
  });

  describe("timer reset on radius exit", () => {
    it("resets timer to zero when cursor moves outside radius", () => {
      // Start with cursor within radius
      let cursorPos: { x: number; y: number } | null = { x: 136, y: 436 };
      const deps = makeDeps({
        getCursorPos: () => cursorPos,
      });
      const state = createCursorAttractionController(deps);

      // Accumulate some timer
      vi.advanceTimersByTime(TICK_INTERVAL_MS * 3);
      expect(state.proximityTimers.get("pet-1")).toBe(600);

      // Move cursor far away (outside radius)
      cursorPos = { x: 1000, y: 1000 };

      vi.advanceTimersByTime(TICK_INTERVAL_MS);
      // Timer should be deleted (reset to zero)
      expect(state.proximityTimers.has("pet-1")).toBe(false);

      destroyCursorAttractionController(state);
    });
  });

  describe("timer trigger at MOUSE_ATTRACT_DELAY_MS", () => {
    it("triggers approach when timer reaches MOUSE_ATTRACT_DELAY_MS", () => {
      const dispatchApproach = vi.fn();
      const deps = makeDeps({ dispatchApproach });
      const state = createCursorAttractionController(deps);

      // Advance enough ticks to reach the delay threshold
      const ticksNeeded = MOUSE_ATTRACT_DELAY_MS / TICK_INTERVAL_MS;
      vi.advanceTimersByTime(MOUSE_ATTRACT_DELAY_MS);

      expect(dispatchApproach).toHaveBeenCalledWith(
        "pet-1",
        expect.any(Number),
        expect.any(Number)
      );

      // Timer should be consumed (deleted) after trigger
      expect(state.proximityTimers.has("pet-1")).toBe(false);

      destroyCursorAttractionController(state);
    });

    it("re-evaluates eligibility at trigger moment (Req 2.7)", () => {
      let petAction: string = "idle";
      const pet = makePet();
      const dispatchApproach = vi.fn();

      const deps = makeDeps({
        getPets: () => [{ ...pet, currentAction: petAction as any }],
        dispatchApproach,
      });
      const state = createCursorAttractionController(deps);

      // Accumulate almost to threshold
      vi.advanceTimersByTime(MOUSE_ATTRACT_DELAY_MS - TICK_INTERVAL_MS);

      // Make pet ineligible right at trigger moment
      petAction = "hop";

      vi.advanceTimersByTime(TICK_INTERVAL_MS);

      // Should NOT dispatch because pet is ineligible at re-evaluation
      expect(dispatchApproach).not.toHaveBeenCalled();

      // Timer should still be consumed
      expect(state.proximityTimers.has("pet-1")).toBe(false);

      destroyCursorAttractionController(state);
    });

    it("resets timer after trigger so pet must re-linger for next attraction", () => {
      const dispatchApproach = vi.fn();
      const deps = makeDeps({ dispatchApproach });
      const state = createCursorAttractionController(deps);

      // Trigger first time
      vi.advanceTimersByTime(MOUSE_ATTRACT_DELAY_MS);
      expect(dispatchApproach).toHaveBeenCalledTimes(1);

      // Timer is consumed
      expect(state.proximityTimers.has("pet-1")).toBe(false);

      destroyCursorAttractionController(state);
    });
  });

  describe("timer reset on ineligibility transition", () => {
    it("resets timer when pet transitions from eligible to ineligible (Req 2.5)", () => {
      let physicsState: string = "idle";
      const pet = makePet();
      const deps = makeDeps({
        getPets: () => [{ ...pet, physicsState: physicsState as any }],
      });
      const state = createCursorAttractionController(deps);

      // Accumulate some timer
      vi.advanceTimersByTime(TICK_INTERVAL_MS * 3);
      expect(state.proximityTimers.get("pet-1")).toBe(600);

      // Pet becomes ineligible (e.g., picked up)
      physicsState = "dragging";

      vi.advanceTimersByTime(TICK_INTERVAL_MS);
      // Timer should be reset
      expect(state.proximityTimers.has("pet-1")).toBe(false);

      destroyCursorAttractionController(state);
    });

    it("resets timer when pet enters a non-idle currentAction (Req 2.5)", () => {
      let currentAction: string = "idle";
      const pet = makePet();
      const deps = makeDeps({
        getPets: () => [{ ...pet, currentAction: currentAction as any }],
      });
      const state = createCursorAttractionController(deps);

      // Accumulate
      vi.advanceTimersByTime(TICK_INTERVAL_MS * 4);
      expect(state.proximityTimers.get("pet-1")).toBe(800);

      // Pet starts resting
      currentAction = "rest";

      vi.advanceTimersByTime(TICK_INTERVAL_MS);
      expect(state.proximityTimers.has("pet-1")).toBe(false);

      destroyCursorAttractionController(state);
    });

    it("does not accumulate timer for ineligible pet even if within radius", () => {
      const pet = makePet({ physicsState: "flying" });
      const deps = makeDeps({
        getPets: () => [pet],
      });
      const state = createCursorAttractionController(deps);

      vi.advanceTimersByTime(TICK_INTERVAL_MS * 5);
      expect(state.proximityTimers.has("pet-1")).toBe(false);

      destroyCursorAttractionController(state);
    });
  });

  describe("cursor null resets all timers", () => {
    it("resets all proximity timers when cursor position is null", () => {
      let cursorPos: { x: number; y: number } | null = { x: 136, y: 436 };

      const pet2 = makePet({ id: "pet-2", x: 120 });
      const deps = makeDeps({
        getCursorPos: () => cursorPos,
        getPets: () => [makePet(), pet2],
      });
      const state = createCursorAttractionController(deps);

      // Accumulate timers for both pets
      vi.advanceTimersByTime(TICK_INTERVAL_MS * 3);
      expect(state.proximityTimers.size).toBeGreaterThan(0);

      // Cursor becomes unavailable
      cursorPos = null;

      vi.advanceTimersByTime(TICK_INTERVAL_MS);
      expect(state.proximityTimers.size).toBe(0);

      destroyCursorAttractionController(state);
    });
  });

  describe("cursor exit cancels active approach (Req 8.5)", () => {
    it("calls cancelApproach when cursor moves beyond radius of an active pet", () => {
      let cursorPos: { x: number; y: number } | null = { x: 136, y: 436 };
      const cancelApproach = vi.fn();
      const dispatchApproach = vi.fn();

      const deps = makeDeps({
        getCursorPos: () => cursorPos,
        dispatchApproach,
        cancelApproach,
      });
      const state = createCursorAttractionController(deps);

      // Trigger approach
      vi.advanceTimersByTime(MOUSE_ATTRACT_DELAY_MS);
      expect(dispatchApproach).toHaveBeenCalled();
      expect(state.activePetIds.has("pet-1")).toBe(true);

      // Move cursor far away
      cursorPos = { x: 1000, y: 1000 };

      vi.advanceTimersByTime(TICK_INTERVAL_MS);
      expect(cancelApproach).toHaveBeenCalledWith("pet-1");

      destroyCursorAttractionController(state);
    });

    it("does not cancel when cursor is still within radius of active pet", () => {
      const cancelApproach = vi.fn();
      const dispatchApproach = vi.fn();

      const deps = makeDeps({
        dispatchApproach,
        cancelApproach,
      });
      const state = createCursorAttractionController(deps);

      // Trigger approach
      vi.advanceTimersByTime(MOUSE_ATTRACT_DELAY_MS);
      expect(state.activePetIds.has("pet-1")).toBe(true);

      // Cursor stays near
      vi.advanceTimersByTime(TICK_INTERVAL_MS * 5);
      expect(cancelApproach).not.toHaveBeenCalled();

      destroyCursorAttractionController(state);
    });
  });

  describe("notifyApproachEnded", () => {
    it("removes pet from activePetIds and releases slot", () => {
      const state: CursorAttractionState = {
        proximityTimers: new Map(),
        cooldownExpiry: new Map(),
        activePetIds: new Set(["pet-1"]),
        assignedSlots: new Map([["pet-1", { x: 100, y: 400 }]]),
        deferredPetIds: [],
        tickTimer: null,
      };

      notifyApproachEnded(state, "pet-1");

      expect(state.activePetIds.has("pet-1")).toBe(false);
      expect(state.assignedSlots.has("pet-1")).toBe(false);
    });

    it("records cooldown expiry timestamp", () => {
      vi.setSystemTime(new Date(10000));

      const state: CursorAttractionState = {
        proximityTimers: new Map(),
        cooldownExpiry: new Map(),
        activePetIds: new Set(["pet-1"]),
        assignedSlots: new Map([["pet-1", { x: 100, y: 400 }]]),
        deferredPetIds: [],
        tickTimer: null,
      };

      notifyApproachEnded(state, "pet-1");

      expect(state.cooldownExpiry.get("pet-1")).toBe(10000 + MOUSE_ATTRACT_COOLDOWN_MS);
    });

    it("resets proximity timer for the pet", () => {
      const state: CursorAttractionState = {
        proximityTimers: new Map([["pet-1", 1000]]),
        cooldownExpiry: new Map(),
        activePetIds: new Set(["pet-1"]),
        assignedSlots: new Map([["pet-1", { x: 100, y: 400 }]]),
        deferredPetIds: [],
        tickTimer: null,
      };

      notifyApproachEnded(state, "pet-1");

      expect(state.proximityTimers.has("pet-1")).toBe(false);
    });
  });

  describe("cooldown prevents re-attraction", () => {
    it("does not accumulate timer for a pet within cooldown period", () => {
      const dispatchApproach = vi.fn();
      const cancelApproach = vi.fn();

      const deps = makeDeps({
        dispatchApproach,
        cancelApproach,
      });
      const state = createCursorAttractionController(deps);

      // Trigger approach
      vi.advanceTimersByTime(MOUSE_ATTRACT_DELAY_MS);
      expect(dispatchApproach).toHaveBeenCalledTimes(1);

      // Simulate approach ended (manually call notifyApproachEnded)
      notifyApproachEnded(state, "pet-1");

      // Now pet is on cooldown — further ticks should NOT accumulate
      vi.advanceTimersByTime(MOUSE_ATTRACT_DELAY_MS);
      expect(dispatchApproach).toHaveBeenCalledTimes(1); // no additional dispatch
      expect(state.proximityTimers.has("pet-1")).toBe(false);

      destroyCursorAttractionController(state);
    });
  });
});
