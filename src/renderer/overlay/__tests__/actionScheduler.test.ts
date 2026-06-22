/**
 * Unit tests for ActionScheduler module.
 * Verifies creation, destruction, guard checks, action selection,
 * and auto-reset timing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createActionScheduler,
  destroyActionScheduler,
  selectAction,
  PhysicsState,
} from "../actionScheduler";
import { MovementProfile, ActionName } from "../movementProfiles";

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

describe("actionScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createActionScheduler", () => {
    it("creates a scheduler with a non-null timerId", () => {
      const profile = makeProfile();
      const state = createActionScheduler(
        "pet-1",
        () => profile,
        () => "idle" as PhysicsState,
        () => "idle" as ActionName,
        vi.fn()
      );

      expect(state.timerId).not.toBeNull();
      expect(state.petId).toBe("pet-1");

      destroyActionScheduler(state);
    });

    it("dispatches an action after the interval elapses", () => {
      const dispatch = vi.fn();
      const profile = makeProfile({ interval: 3000 });

      const state = createActionScheduler(
        "pet-1",
        () => profile,
        () => "idle" as PhysicsState,
        () => "idle" as ActionName,
        dispatch
      );

      // Advance past first interval
      vi.advanceTimersByTime(3000);

      // Should have dispatched an action (hop) and scheduled idle reset
      expect(dispatch).toHaveBeenCalledWith("hop");

      destroyActionScheduler(state);
    });

    it("uses minimum interval of 1000ms when profile interval is 0", () => {
      const dispatch = vi.fn();
      const profile = makeProfile({ interval: 0 });

      const state = createActionScheduler(
        "pet-1",
        () => profile,
        () => "idle" as PhysicsState,
        () => "idle" as ActionName,
        dispatch
      );

      // At 999ms, no dispatch yet
      vi.advanceTimersByTime(999);
      expect(dispatch).not.toHaveBeenCalled();

      // At 1000ms, dispatch happens
      vi.advanceTimersByTime(1);
      expect(dispatch).toHaveBeenCalledWith("hop");

      destroyActionScheduler(state);
    });

    it("uses minimum interval of 1000ms when profile interval is negative", () => {
      const dispatch = vi.fn();
      const profile = makeProfile({ interval: -500 });

      const state = createActionScheduler(
        "pet-1",
        () => profile,
        () => "idle" as PhysicsState,
        () => "idle" as ActionName,
        dispatch
      );

      vi.advanceTimersByTime(999);
      expect(dispatch).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(dispatch).toHaveBeenCalled();

      destroyActionScheduler(state);
    });
  });

  describe("destroyActionScheduler", () => {
    it("clears the interval timer", () => {
      const profile = makeProfile();
      const dispatch = vi.fn();

      const state = createActionScheduler(
        "pet-1",
        () => profile,
        () => "idle" as PhysicsState,
        () => "idle" as ActionName,
        dispatch
      );

      destroyActionScheduler(state);
      expect(state.timerId).toBeNull();

      // Advancing time should not trigger dispatch
      vi.advanceTimersByTime(10000);
      expect(dispatch).not.toHaveBeenCalled();
    });

    it("handles null timerId gracefully", () => {
      const state = { timerId: null, petId: "pet-1" };
      expect(() => destroyActionScheduler(state)).not.toThrow();
    });
  });

  describe("guard checks", () => {
    it("skips dispatch when physicsState is not idle", () => {
      const dispatch = vi.fn();
      const profile = makeProfile({ interval: 1000 });
      const physicsStates: PhysicsState[] = [
        "dragging",
        "flying",
        "landed",
        "gettingUp",
      ];

      for (const ps of physicsStates) {
        dispatch.mockClear();

        const state = createActionScheduler(
          "pet-1",
          () => profile,
          () => ps,
          () => "idle" as ActionName,
          dispatch
        );

        vi.advanceTimersByTime(1000);
        expect(dispatch).not.toHaveBeenCalled();

        destroyActionScheduler(state);
      }
    });

    it("skips dispatch when currentAction is not idle", () => {
      const dispatch = vi.fn();
      const profile = makeProfile({ interval: 1000 });

      const state = createActionScheduler(
        "pet-1",
        () => profile,
        () => "idle" as PhysicsState,
        () => "hop" as ActionName,
        dispatch
      );

      vi.advanceTimersByTime(1000);
      expect(dispatch).not.toHaveBeenCalled();

      destroyActionScheduler(state);
    });

    it("skips dispatch when both physicsState and currentAction are non-idle", () => {
      const dispatch = vi.fn();
      const profile = makeProfile({ interval: 1000 });

      const state = createActionScheduler(
        "pet-1",
        () => profile,
        () => "dragging" as PhysicsState,
        () => "hop" as ActionName,
        dispatch
      );

      vi.advanceTimersByTime(1000);
      expect(dispatch).not.toHaveBeenCalled();

      destroyActionScheduler(state);
    });
  });

  describe("auto-reset to idle", () => {
    it("resets to idle after duration + landingPauseMs", () => {
      const dispatch = vi.fn();
      const profile = makeProfile({
        interval: 1000,
        duration: 500,
        landingPauseMs: 350,
      });

      const state = createActionScheduler(
        "pet-1",
        () => profile,
        () => "idle" as PhysicsState,
        () => "idle" as ActionName,
        dispatch
      );

      // Trigger action
      vi.advanceTimersByTime(1000);
      expect(dispatch).toHaveBeenCalledWith("hop");

      // Before total active time (500 + 350 = 850ms), no idle reset
      vi.advanceTimersByTime(849);
      expect(dispatch).not.toHaveBeenCalledWith("idle");

      // At 850ms after action, idle is dispatched
      vi.advanceTimersByTime(1);
      expect(dispatch).toHaveBeenCalledWith("idle");

      destroyActionScheduler(state);
    });

    it("uses minimum duration of 100ms when duration is 0", () => {
      const dispatch = vi.fn();
      const profile = makeProfile({
        interval: 1000,
        duration: 0,
        landingPauseMs: 0,
      });

      const state = createActionScheduler(
        "pet-1",
        () => profile,
        () => "idle" as PhysicsState,
        () => "idle" as ActionName,
        dispatch
      );

      vi.advanceTimersByTime(1000);
      expect(dispatch).toHaveBeenCalledWith("hop");

      // Should reset after 100ms (minimum duration)
      vi.advanceTimersByTime(99);
      expect(dispatch).not.toHaveBeenCalledWith("idle");

      vi.advanceTimersByTime(1);
      expect(dispatch).toHaveBeenCalledWith("idle");

      destroyActionScheduler(state);
    });

    it("uses minimum duration of 100ms when duration is negative", () => {
      const dispatch = vi.fn();
      const profile = makeProfile({
        interval: 1000,
        duration: -200,
        landingPauseMs: 0,
      });

      const state = createActionScheduler(
        "pet-1",
        () => profile,
        () => "idle" as PhysicsState,
        () => "idle" as ActionName,
        dispatch
      );

      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(100);
      expect(dispatch).toHaveBeenCalledWith("idle");

      destroyActionScheduler(state);
    });
  });

  describe("edge cases", () => {
    it("does not dispatch when eligibleActions is empty", () => {
      const dispatch = vi.fn();
      const profile = makeProfile({
        interval: 1000,
        eligibleActions: [],
        actionWeights: {},
      });

      const state = createActionScheduler(
        "pet-1",
        () => profile,
        () => "idle" as PhysicsState,
        () => "idle" as ActionName,
        dispatch
      );

      vi.advanceTimersByTime(5000);
      expect(dispatch).not.toHaveBeenCalled();

      destroyActionScheduler(state);
    });

    it("does not dispatch when all probabilities are 0", () => {
      const dispatch = vi.fn();
      const profile = makeProfile({
        interval: 1000,
        eligibleActions: ["hop", "squish"],
        actionWeights: { hop: 0, squish: 0 },
      });

      const state = createActionScheduler(
        "pet-1",
        () => profile,
        () => "idle" as PhysicsState,
        () => "idle" as ActionName,
        dispatch
      );

      vi.advanceTimersByTime(5000);
      expect(dispatch).not.toHaveBeenCalled();

      destroyActionScheduler(state);
    });
  });
});

describe("selectAction", () => {
  it("returns null for empty eligibleActions", () => {
    const profile = makeProfile({ eligibleActions: [], actionWeights: {} });
    expect(selectAction(profile)).toBeNull();
  });

  it("returns null when all probabilities sum to 0", () => {
    const profile = makeProfile({
      eligibleActions: ["hop", "squish"],
      actionWeights: { hop: 0, squish: 0 },
    });
    expect(selectAction(profile)).toBeNull();
  });

  it("returns the only eligible action when there is one with positive probability", () => {
    const profile = makeProfile({
      eligibleActions: ["leap"],
      actionWeights: { leap: 1.0 },
    });
    expect(selectAction(profile)).toBe("leap");
  });

  it("only selects from eligible actions", () => {
    const profile = makeProfile({
      eligibleActions: ["bob", "drift"],
      actionWeights: { bob: 0.5, drift: 0.5, hop: 1.0 },
    });

    // Run multiple times to check it never returns "hop"
    for (let i = 0; i < 50; i++) {
      const result = selectAction(profile);
      expect(result === "bob" || result === "drift").toBe(true);
    }
  });

  it("handles eligible actions with no explicit probability (treated as 0)", () => {
    const profile = makeProfile({
      eligibleActions: ["hop", "squish"],
      actionWeights: { hop: 0.5 }, // squish has no entry → 0
    });

    // Should only ever select "hop"
    for (let i = 0; i < 50; i++) {
      expect(selectAction(profile)).toBe("hop");
    }
  });
});
