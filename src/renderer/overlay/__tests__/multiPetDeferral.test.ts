import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  notifyApproachEnded,
  createCursorAttractionController,
  destroyCursorAttractionController,
  MOUSE_ATTRACT_MAX_PETS,
  MOUSE_ATTRACT_DELAY_MS,
  MOUSE_ATTRACT_COOLDOWN_MS,
  MOUSE_ATTRACT_RADIUS,
  MOUSE_ATTRACT_TARGET_SPACING,
  type CursorAttractionState,
  type CursorAttractionDeps,
} from "../cursorAttractionController";
import type { PetOverlayState } from "../../OverlayApp";
import type { MovementProfile } from "../movementProfiles";

const DEFAULT_PROFILE: MovementProfile = {
  actionType: "grounded",
  movementStyle: "grounded",
  eligibleActions: ["hop", "idle"],
  stepDistance: 30,
  hopHeight: 20,
  duration: 400,
  interval: 3000,
  landingPauseMs: 100,
  hoverOffsetY: 0,
  groundOffsetY: 0,
  actionWeights: { hop: 1, idle: 1 },
};

function createMockPet(id: string, x: number, overrides: Partial<PetOverlayState> = {}): PetOverlayState {
  return {
    id,
    pet: {} as any,
    x,
    y: 500,
    vx: 0,
    vy: 0,
    rotation: 0,
    angularVel: 0,
    direction: 1,
    currentAction: "idle",
    physicsState: "idle",
    visualState: "idle",
    lifecycleState: "normal",
    resolvedProfile: DEFAULT_PROFILE,
    restTimer: null,
    message: null,
    messageTimer: null,
    hasFoundEgg: false,
    isHovered: false,
    isLeaving: false,
    ...overrides,
  };
}

function createState(overrides: Partial<CursorAttractionState> = {}): CursorAttractionState {
  return {
    proximityTimers: new Map(),
    cooldownExpiry: new Map(),
    activePetIds: new Set(),
    assignedSlots: new Map(),
    deferredPetIds: [],
    tickTimer: null,
    ...overrides,
  };
}

function createMockDeps(overrides: Partial<CursorAttractionDeps> = {}): CursorAttractionDeps {
  return {
    getCursorPos: () => ({ x: 500, y: 500 }),
    getPets: () => [],
    getViewportWidth: () => 1920,
    getGroundY: () => 600,
    dispatchApproach: vi.fn(),
    cancelApproach: vi.fn(),
    ...overrides,
  };
}

describe("Multi-pet limiting and deferral logic (Task 5.3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Requirement 4.1: activePetIds.size never exceeds MOUSE_ATTRACT_MAX_PETS", () => {
    it("limits active pets to MOUSE_ATTRACT_MAX_PETS", () => {
      // Create more than MAX_PETS eligible pets within radius
      const pets = Array.from({ length: 5 }, (_, i) =>
        createMockPet(`pet-${i}`, 450 + i * 10)
      );

      const dispatchApproach = vi.fn();
      const deps = createMockDeps({
        getCursorPos: () => ({ x: 500, y: 500 }),
        getPets: () => pets,
        dispatchApproach,
      });

      const state = createCursorAttractionController(deps);

      // Pre-accumulate proximity timers to just below threshold
      for (const pet of pets) {
        state.proximityTimers.set(pet.id, MOUSE_ATTRACT_DELAY_MS - 200);
      }

      // Advance one tick to trigger
      vi.advanceTimersByTime(200);

      // Should only dispatch MAX_PETS approaches
      expect(dispatchApproach).toHaveBeenCalledTimes(MOUSE_ATTRACT_MAX_PETS);
      expect(state.activePetIds.size).toBeLessThanOrEqual(MOUSE_ATTRACT_MAX_PETS);

      destroyCursorAttractionController(state);
    });
  });

  describe("Requirement 4.3: No already-active pet is removed to make room", () => {
    it("does not evict active pets when new ones trigger", () => {
      const activePets = Array.from({ length: MOUSE_ATTRACT_MAX_PETS }, (_, i) =>
        createMockPet(`active-${i}`, 450 + i * 10, { currentAction: "approachCursor" })
      );
      const newPet = createMockPet("new-pet", 460);

      const dispatchApproach = vi.fn();
      const deps = createMockDeps({
        getCursorPos: () => ({ x: 500, y: 500 }),
        getPets: () => [...activePets, newPet],
        dispatchApproach,
      });

      const state = createCursorAttractionController(deps);

      // Mark active pets as active in controller state
      for (const pet of activePets) {
        state.activePetIds.add(pet.id);
        state.assignedSlots.set(pet.id, { x: 500, y: 500 });
      }

      // Pre-accumulate proximity timer for new pet to trigger
      state.proximityTimers.set("new-pet", MOUSE_ATTRACT_DELAY_MS - 200);

      vi.advanceTimersByTime(200);

      // All original active pets should still be active
      for (const pet of activePets) {
        expect(state.activePetIds.has(pet.id)).toBe(true);
      }

      // New pet should NOT have been dispatched (no room)
      expect(dispatchApproach).not.toHaveBeenCalled();

      destroyCursorAttractionController(state);
    });
  });

  describe("Requirement 4.4: Newly triggered pets are deferred when full", () => {
    it("adds triggered pets to deferredPetIds when slots are full", () => {
      const activePets = Array.from({ length: MOUSE_ATTRACT_MAX_PETS }, (_, i) =>
        createMockPet(`active-${i}`, 450 + i * 10, { currentAction: "approachCursor" })
      );
      const deferredPet = createMockPet("deferred-pet", 465);

      const deps = createMockDeps({
        getCursorPos: () => ({ x: 500, y: 500 }),
        getPets: () => [...activePets, deferredPet],
      });

      const state = createCursorAttractionController(deps);

      // Mark active pets
      for (const pet of activePets) {
        state.activePetIds.add(pet.id);
        state.assignedSlots.set(pet.id, { x: 500, y: 500 });
      }

      // Pre-accumulate timer for deferred pet
      state.proximityTimers.set("deferred-pet", MOUSE_ATTRACT_DELAY_MS - 200);

      vi.advanceTimersByTime(200);

      // Pet should be deferred
      expect(state.deferredPetIds).toContain("deferred-pet");

      destroyCursorAttractionController(state);
    });
  });

  describe("Requirement 4.5: When slot opens, nearest deferred pet is activated", () => {
    it("activates the first deferred pet when a slot opens via notifyApproachEnded", () => {
      const pet1 = createMockPet("deferred-1", 470);
      const pet2 = createMockPet("deferred-2", 480);

      const dispatchApproach = vi.fn();
      const deps = createMockDeps({
        getCursorPos: () => ({ x: 500, y: 500 }),
        getPets: () => [pet1, pet2],
        dispatchApproach,
      });

      const state = createState({
        activePetIds: new Set(["active-pet"]),
        assignedSlots: new Map([["active-pet", { x: 500, y: 500 }]]),
        deferredPetIds: ["deferred-1", "deferred-2"], // ordered by distance
      });

      // Simulate slot opening by calling notifyApproachEnded with deps
      notifyApproachEnded(state, "active-pet", deps);

      // Should activate the first deferred pet (nearest)
      expect(dispatchApproach).toHaveBeenCalledTimes(1);
      expect(dispatchApproach).toHaveBeenCalledWith("deferred-1", expect.any(Number), expect.any(Number));
      expect(state.activePetIds.has("deferred-1")).toBe(true);
      expect(state.assignedSlots.has("deferred-1")).toBe(true);
      // Second deferred pet should still be waiting
      expect(state.deferredPetIds).toContain("deferred-2");
      expect(state.deferredPetIds).not.toContain("deferred-1");
    });

    it("skips deferred pets that no longer exist", () => {
      const pet2 = createMockPet("deferred-2", 480);

      const dispatchApproach = vi.fn();
      const deps = createMockDeps({
        getCursorPos: () => ({ x: 500, y: 500 }),
        // Only pet2 exists — pet1 was removed
        getPets: () => [pet2],
        dispatchApproach,
      });

      const state = createState({
        activePetIds: new Set(["active-pet"]),
        assignedSlots: new Map([["active-pet", { x: 500, y: 500 }]]),
        deferredPetIds: ["deferred-1", "deferred-2"],
      });

      notifyApproachEnded(state, "active-pet", deps);

      // Should skip deferred-1 (doesn't exist) and activate deferred-2
      expect(dispatchApproach).toHaveBeenCalledTimes(1);
      expect(dispatchApproach).toHaveBeenCalledWith("deferred-2", expect.any(Number), expect.any(Number));
      expect(state.activePetIds.has("deferred-2")).toBe(true);
    });

    it("skips deferred pets that are no longer eligible", () => {
      // Pet 1 is now in dragging state (ineligible)
      const pet1 = createMockPet("deferred-1", 470, { physicsState: "dragging" });
      const pet2 = createMockPet("deferred-2", 480);

      const dispatchApproach = vi.fn();
      const deps = createMockDeps({
        getCursorPos: () => ({ x: 500, y: 500 }),
        getPets: () => [pet1, pet2],
        dispatchApproach,
      });

      const state = createState({
        activePetIds: new Set(["active-pet"]),
        assignedSlots: new Map([["active-pet", { x: 500, y: 500 }]]),
        deferredPetIds: ["deferred-1", "deferred-2"],
      });

      notifyApproachEnded(state, "active-pet", deps);

      // Should skip deferred-1 (ineligible) and activate deferred-2
      expect(dispatchApproach).toHaveBeenCalledTimes(1);
      expect(dispatchApproach).toHaveBeenCalledWith("deferred-2", expect.any(Number), expect.any(Number));
      expect(state.activePetIds.has("deferred-2")).toBe(true);
    });

    it("does not activate deferred if no cursor position available", () => {
      const pet1 = createMockPet("deferred-1", 470);

      const dispatchApproach = vi.fn();
      const deps = createMockDeps({
        getCursorPos: () => null, // cursor unavailable
        getPets: () => [pet1],
        dispatchApproach,
      });

      const state = createState({
        activePetIds: new Set(["active-pet"]),
        assignedSlots: new Map([["active-pet", { x: 500, y: 500 }]]),
        deferredPetIds: ["deferred-1"],
      });

      notifyApproachEnded(state, "active-pet", deps);

      // Should NOT dispatch because cursor is unavailable
      expect(dispatchApproach).not.toHaveBeenCalled();
      // Deferred pet should remain in the list
      expect(state.deferredPetIds).toContain("deferred-1");
    });

    it("does not activate deferred if activePetIds is already at max", () => {
      const pet1 = createMockPet("deferred-1", 470);

      const dispatchApproach = vi.fn();
      const deps = createMockDeps({
        getCursorPos: () => ({ x: 500, y: 500 }),
        getPets: () => [pet1],
        dispatchApproach,
      });

      // Simulate: one slot released, but MAX_PETS are already active (other slots filled)
      const activePets = new Set(
        Array.from({ length: MOUSE_ATTRACT_MAX_PETS }, (_, i) => `other-${i}`)
      );
      const state = createState({
        activePetIds: activePets,
        assignedSlots: new Map([...activePets].map((id) => [id, { x: 500, y: 500 }])),
        deferredPetIds: ["deferred-1"],
      });

      // Calling notifyApproachEnded removes the petId first, so one less active
      // But we set up MAX_PETS without the ended one, so it actually has room
      // Let's test with a state where after removing the ended pet it's still full
      // Actually notifyApproachEnded first removes the petId, so if we add one more:
      const fullState = createState({
        activePetIds: new Set([
          "ending-pet",
          ...Array.from({ length: MOUSE_ATTRACT_MAX_PETS }, (_, i) => `other-${i}`),
        ]),
        assignedSlots: new Map([
          ["ending-pet", { x: 500, y: 500 }],
          ...Array.from({ length: MOUSE_ATTRACT_MAX_PETS }, (_, i) => [`other-${i}`, { x: 500, y: 500 }] as [string, {x: number, y: number}]),
        ]),
        deferredPetIds: ["deferred-1"],
      });

      notifyApproachEnded(fullState, "ending-pet", deps);

      // After removing ending-pet, activePetIds.size === MOUSE_ATTRACT_MAX_PETS
      // So no room for deferred pet
      expect(dispatchApproach).not.toHaveBeenCalled();
      expect(fullState.deferredPetIds).toContain("deferred-1");
    });

    it("without deps, notifyApproachEnded still works (no deferral activation)", () => {
      const state = createState({
        activePetIds: new Set(["active-pet"]),
        assignedSlots: new Map([["active-pet", { x: 500, y: 500 }]]),
        deferredPetIds: ["deferred-1"],
      });

      // Call without deps — backward compatibility
      notifyApproachEnded(state, "active-pet");

      // Slot released but no deferred activation
      expect(state.activePetIds.has("active-pet")).toBe(false);
      expect(state.deferredPetIds).toContain("deferred-1");
    });
  });

  describe("Deferred pet cleanup during tick", () => {
    it("removes deferred pets that no longer exist from deferredPetIds during tick", () => {
      // Only pet2 exists
      const pet2 = createMockPet("pet-2", 480);

      const deps = createMockDeps({
        getCursorPos: () => ({ x: 500, y: 500 }),
        getPets: () => [pet2],
      });

      const state = createCursorAttractionController(deps);
      state.deferredPetIds = ["pet-1", "pet-2"]; // pet-1 doesn't exist

      vi.advanceTimersByTime(200); // one tick

      // pet-1 should be cleaned up (doesn't exist)
      expect(state.deferredPetIds).not.toContain("pet-1");

      destroyCursorAttractionController(state);
    });

    it("removes deferred pets that become ineligible during tick", () => {
      // Pet1 is now dragging (ineligible)
      const pet1 = createMockPet("pet-1", 470, { physicsState: "dragging" });
      const pet2 = createMockPet("pet-2", 480);

      const deps = createMockDeps({
        getCursorPos: () => ({ x: 500, y: 500 }),
        getPets: () => [pet1, pet2],
      });

      const state = createCursorAttractionController(deps);
      state.deferredPetIds = ["pet-1", "pet-2"];

      vi.advanceTimersByTime(200);

      // pet-1 should be cleaned up (ineligible)
      expect(state.deferredPetIds).not.toContain("pet-1");

      destroyCursorAttractionController(state);
    });
  });
});
