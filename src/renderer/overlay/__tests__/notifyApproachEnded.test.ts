import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  notifyApproachEnded,
  MOUSE_ATTRACT_COOLDOWN_MS,
  MOUSE_ATTRACT_MAX_PETS,
  type CursorAttractionState,
} from "../cursorAttractionController";

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

describe("notifyApproachEnded", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes petId from activePetIds", () => {
    const state = createState({
      activePetIds: new Set(["pet-1", "pet-2"]),
      assignedSlots: new Map([
        ["pet-1", { x: 100, y: 200 }],
        ["pet-2", { x: 160, y: 200 }],
      ]),
    });

    notifyApproachEnded(state, "pet-1");

    expect(state.activePetIds.has("pet-1")).toBe(false);
    expect(state.activePetIds.has("pet-2")).toBe(true);
  });

  it("releases assigned slot from assignedSlots", () => {
    const state = createState({
      activePetIds: new Set(["pet-1", "pet-2"]),
      assignedSlots: new Map([
        ["pet-1", { x: 100, y: 200 }],
        ["pet-2", { x: 160, y: 200 }],
      ]),
    });

    notifyApproachEnded(state, "pet-1");

    expect(state.assignedSlots.has("pet-1")).toBe(false);
    expect(state.assignedSlots.has("pet-2")).toBe(true);
  });

  it("records cooldown expiry as Date.now() + MOUSE_ATTRACT_COOLDOWN_MS", () => {
    const state = createState({
      activePetIds: new Set(["pet-1"]),
      assignedSlots: new Map([["pet-1", { x: 100, y: 200 }]]),
    });

    notifyApproachEnded(state, "pet-1");

    expect(state.cooldownExpiry.get("pet-1")).toBe(10000 + MOUSE_ATTRACT_COOLDOWN_MS);
  });

  it("resets proximity timer for the pet", () => {
    const state = createState({
      activePetIds: new Set(["pet-1"]),
      assignedSlots: new Map([["pet-1", { x: 100, y: 200 }]]),
      proximityTimers: new Map([["pet-1", 1500]]),
    });

    notifyApproachEnded(state, "pet-1");

    expect(state.proximityTimers.has("pet-1")).toBe(false);
  });

  it("does not affect other pets' state", () => {
    const state = createState({
      activePetIds: new Set(["pet-1", "pet-2"]),
      assignedSlots: new Map([
        ["pet-1", { x: 100, y: 200 }],
        ["pet-2", { x: 160, y: 200 }],
      ]),
      proximityTimers: new Map([["pet-2", 500]]),
      cooldownExpiry: new Map([["pet-3", 9000]]),
    });

    notifyApproachEnded(state, "pet-1");

    expect(state.activePetIds.has("pet-2")).toBe(true);
    expect(state.assignedSlots.get("pet-2")).toEqual({ x: 160, y: 200 });
    expect(state.proximityTimers.get("pet-2")).toBe(500);
    expect(state.cooldownExpiry.get("pet-3")).toBe(9000);
  });

  it("applies cooldown regardless of completion vs cancellation (same function called for both)", () => {
    // Requirement 3.1: cooldown is recorded the same way whether completed or cancelled
    const state = createState({
      activePetIds: new Set(["pet-a"]),
      assignedSlots: new Map([["pet-a", { x: 300, y: 200 }]]),
    });

    notifyApproachEnded(state, "pet-a");

    expect(state.cooldownExpiry.get("pet-a")).toBe(10000 + MOUSE_ATTRACT_COOLDOWN_MS);
  });

  it("handles pet that is not in activePetIds gracefully (idempotent)", () => {
    const state = createState();

    // Should not throw
    expect(() => notifyApproachEnded(state, "non-existent")).not.toThrow();
    expect(state.cooldownExpiry.get("non-existent")).toBe(10000 + MOUSE_ATTRACT_COOLDOWN_MS);
  });
});
