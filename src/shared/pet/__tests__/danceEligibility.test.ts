import { describe, it, expect } from "vitest";
import {
  isPetHealthyForDance,
  isPetEligibleForDance,
  DANCE_HEALTH_STAT_THRESHOLD,
} from "../danceEligibility";

describe("isPetHealthyForDance", () => {
  it("returns true when all stats are at threshold (boundary)", () => {
    expect(
      isPetHealthyForDance({
        hunger: DANCE_HEALTH_STAT_THRESHOLD,
        happiness: DANCE_HEALTH_STAT_THRESHOLD,
        energy: DANCE_HEALTH_STAT_THRESHOLD,
        cleanliness: DANCE_HEALTH_STAT_THRESHOLD,
      }),
    ).toBe(true);
  });

  it("returns true when all stats are above threshold", () => {
    expect(
      isPetHealthyForDance({
        hunger: 80,
        happiness: 90,
        energy: 75,
        cleanliness: 100,
      }),
    ).toBe(true);
  });

  it("returns false when energy is at 49 (just below threshold)", () => {
    expect(
      isPetHealthyForDance({
        hunger: 50,
        happiness: 50,
        energy: 49,
        cleanliness: 50,
      }),
    ).toBe(false);
  });

  it("returns false when hunger is below threshold", () => {
    expect(
      isPetHealthyForDance({
        hunger: 30,
        happiness: 80,
        energy: 80,
        cleanliness: 80,
      }),
    ).toBe(false);
  });

  it("returns false when happiness is below threshold", () => {
    expect(
      isPetHealthyForDance({
        hunger: 80,
        happiness: 10,
        energy: 80,
        cleanliness: 80,
      }),
    ).toBe(false);
  });

  it("returns false when cleanliness is below threshold", () => {
    expect(
      isPetHealthyForDance({
        hunger: 80,
        happiness: 80,
        energy: 80,
        cleanliness: 0,
      }),
    ).toBe(false);
  });
});

describe("isPetEligibleForDance", () => {
  const healthyStats = { hunger: 80, happiness: 80, energy: 80, cleanliness: 80 };
  const now = Date.now();

  const idlePet = {
    physicsState: "idle",
    currentAction: "idle",
    lifecycleState: "normal",
    isAlive: true,
  };

  it("returns true for healthy idle alive pet with no cooldown", () => {
    expect(isPetEligibleForDance(idlePet, healthyStats, undefined, now)).toBe(true);
  });

  it("returns false for dead pet", () => {
    expect(
      isPetEligibleForDance(
        { ...idlePet, isAlive: false },
        healthyStats,
        undefined,
        now,
      ),
    ).toBe(false);
  });

  it("returns false when physicsState is drag", () => {
    expect(
      isPetEligibleForDance(
        { ...idlePet, physicsState: "drag" },
        healthyStats,
        undefined,
        now,
      ),
    ).toBe(false);
  });

  it("returns false when physicsState is flying", () => {
    expect(
      isPetEligibleForDance(
        { ...idlePet, physicsState: "flying" },
        healthyStats,
        undefined,
        now,
      ),
    ).toBe(false);
  });

  it("returns false when physicsState is landed", () => {
    expect(
      isPetEligibleForDance(
        { ...idlePet, physicsState: "landed" },
        healthyStats,
        undefined,
        now,
      ),
    ).toBe(false);
  });

  it("returns false when physicsState is gettingUp", () => {
    expect(
      isPetEligibleForDance(
        { ...idlePet, physicsState: "gettingUp" },
        healthyStats,
        undefined,
        now,
      ),
    ).toBe(false);
  });

  it("returns false when currentAction is autonomousRest", () => {
    expect(
      isPetEligibleForDance(
        { ...idlePet, currentAction: "autonomousRest" },
        healthyStats,
        undefined,
        now,
      ),
    ).toBe(false);
  });

  it("returns false when currentAction is playTogether", () => {
    expect(
      isPetEligibleForDance(
        { ...idlePet, currentAction: "playTogether" },
        healthyStats,
        undefined,
        now,
      ),
    ).toBe(false);
  });

  it("returns false when currentAction is dance (self-exclusion)", () => {
    expect(
      isPetEligibleForDance(
        { ...idlePet, currentAction: "dance" },
        healthyStats,
        undefined,
        now,
      ),
    ).toBe(false);
  });

  it("returns false when currentAction is approachCursor", () => {
    expect(
      isPetEligibleForDance(
        { ...idlePet, currentAction: "approachCursor" },
        healthyStats,
        undefined,
        now,
      ),
    ).toBe(false);
  });

  it("returns false when lifecycleState is evolving", () => {
    expect(
      isPetEligibleForDance(
        { ...idlePet, lifecycleState: "evolving" },
        healthyStats,
        undefined,
        now,
      ),
    ).toBe(false);
  });

  it("returns false when cooldown has not expired", () => {
    const futureExpiry = now + 10_000;
    expect(isPetEligibleForDance(idlePet, healthyStats, futureExpiry, now)).toBe(false);
  });

  it("returns true when cooldown has expired", () => {
    const pastExpiry = now - 1;
    expect(isPetEligibleForDance(idlePet, healthyStats, pastExpiry, now)).toBe(true);
  });

  it("returns true when cooldownExpiry equals now (boundary)", () => {
    expect(isPetEligibleForDance(idlePet, healthyStats, now, now)).toBe(true);
  });

  it("returns false when pet is unhealthy", () => {
    const lowStats = { hunger: 30, happiness: 80, energy: 80, cleanliness: 80 };
    expect(isPetEligibleForDance(idlePet, lowStats, undefined, now)).toBe(false);
  });
});
