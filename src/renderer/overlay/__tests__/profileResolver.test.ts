import { describe, it, expect } from "vitest";
import { resolveProfile, computeResolvedRestY } from "../profileResolver";
import {
  MovementProfile,
  SpeciesProfiles,
  GLOBAL_DEFAULT_PROFILE,
  MOVEMENT_PROFILES,
} from "../movementProfiles";

describe("resolveProfile", () => {
  it("returns global default for unknown species", () => {
    const result = resolveProfile("unknown_species", "adult", MOVEMENT_PROFILES);
    expect(result).toEqual(GLOBAL_DEFAULT_PROFILE);
  });

  it("returns global default for empty profiles registry", () => {
    const result = resolveProfile("blob", "adult", {});
    expect(result).toEqual(GLOBAL_DEFAULT_PROFILE);
  });

  it("resolves species default when lifeStage not found", () => {
    const result = resolveProfile("blob", "elder", MOVEMENT_PROFILES);
    // Should be blob's default profile merged over global default
    expect(result.actionType).toBe("hop");
    expect(result.movementStyle).toBe("grounded");
    expect(result.eligibleActions).toEqual(["idle", "hop", "squish"]);
    expect(result.stepDistance).toBe(80);
    expect(result.interval).toBe(3500);
  });

  it("resolves blob baby with field-by-field merge from species default", () => {
    const result = resolveProfile("blob", "baby", MOVEMENT_PROFILES);
    // Overridden fields from baby profile
    expect(result.actionType).toBe("hop");
    expect(result.eligibleActions).toEqual(["idle", "tinyHop", "bounce"]);
    expect(result.stepDistance).toBe(30);
    expect(result.hopHeight).toBe(8);
    // actionWeights uses entry-level merge: species default {hop:4, squish:2, idle:3} + baby {tinyHop:4, bounce:2, idle:4}
    expect(result.actionWeights).toEqual({ hop: 4, squish: 2, idle: 4, tinyHop: 4, bounce: 2 });
    // Inherited from species default (not overridden in baby)
    expect(result.movementStyle).toBe("grounded");
    expect(result.interval).toBe(3500);
    expect(result.landingPauseMs).toBe(0);
    expect(result.hoverOffsetY).toBe(0);
    expect(result.groundOffsetY).toBe(0);
  });

  it("resolves blob child with partial override", () => {
    const result = resolveProfile("blob", "child", MOVEMENT_PROFILES);
    // Overridden fields
    expect(result.stepDistance).toBe(60);
    expect(result.hopHeight).toBe(18);
    expect(result.eligibleActions).toEqual(["idle", "hop", "bounce"]);
    // actionWeights uses entry-level merge: species default {hop:4, squish:2, idle:3} + child {hop:4, bounce:2, idle:3}
    expect(result.actionWeights).toEqual({ hop: 4, squish: 2, idle: 3, bounce: 2 });
    // Inherited from species default
    expect(result.actionType).toBe("hop");
    expect(result.movementStyle).toBe("grounded");
    expect(result.interval).toBe(3500);
  });

  it("resolves frog baby as floating with bob/drift", () => {
    const result = resolveProfile("frog", "baby", MOVEMENT_PROFILES);
    expect(result.movementStyle).toBe("floating");
    expect(result.eligibleActions).toEqual(["idle", "bob", "drift"]);
    expect(result.hoverOffsetY).toBe(12);
    expect(result.stepDistance).toBe(30);
    expect(result.hopHeight).toBe(0);
    // actionWeights uses entry-level merge: frog default {leap:5, hop:2, idle:3} + baby {bob:4, drift:3, idle:3}
    expect(result.actionWeights).toEqual({ leap: 5, hop: 2, idle: 3, bob: 4, drift: 3 });
    // Inherited from frog species default
    expect(result.interval).toBe(3000);
  });

  it("resolves frog adult inheriting species default (empty override)", () => {
    const result = resolveProfile("frog", "adult", MOVEMENT_PROFILES);
    // frog adult has empty override {}, so inherits species default entirely
    expect(result.actionType).toBe("leap");
    expect(result.movementStyle).toBe("grounded");
    expect(result.eligibleActions).toEqual(["idle", "leap", "hop"]);
    expect(result.stepDistance).toBe(150);
    expect(result.hopHeight).toBe(60);
    expect(result.duration).toBe(400);
    expect(result.interval).toBe(3000);
    expect(result.landingPauseMs).toBe(350);
    expect(result.actionWeights).toEqual({ leap: 5, hop: 2, idle: 3 });
  });

  it("resolves frog child with grounded movement override", () => {
    const result = resolveProfile("frog", "child", MOVEMENT_PROFILES);
    expect(result.movementStyle).toBe("grounded");
    expect(result.stepDistance).toBe(100);
    expect(result.hopHeight).toBe(35);
    expect(result.eligibleActions).toEqual(["idle", "smallLeap", "hop"]);
    // actionWeights uses entry-level merge: frog default {leap:5, hop:2, idle:3} + child {smallLeap:4, hop:3, idle:3}
    expect(result.actionWeights).toEqual({ leap: 5, hop: 3, idle: 3, smallLeap: 4 });
    // Inherited from frog species default
    expect(result.interval).toBe(3000);
    expect(result.landingPauseMs).toBe(350);
  });

  it("always returns a complete profile with all required fields", () => {
    const result = resolveProfile("blob", "baby", MOVEMENT_PROFILES);
    expect(result.actionType).toBeDefined();
    expect(result.movementStyle).toBeDefined();
    expect(result.eligibleActions).toBeDefined();
    expect(typeof result.stepDistance).toBe("number");
    expect(typeof result.hopHeight).toBe("number");
    expect(typeof result.duration).toBe("number");
    expect(typeof result.interval).toBe("number");
    expect(typeof result.landingPauseMs).toBe("number");
    expect(typeof result.hoverOffsetY).toBe("number");
    expect(typeof result.groundOffsetY).toBe("number");
    expect(result.actionWeights).toBeDefined();
  });

  it("does not mutate the original profiles or global default", () => {
    const originalDefault = { ...GLOBAL_DEFAULT_PROFILE };
    resolveProfile("blob", "baby", MOVEMENT_PROFILES);
    expect(GLOBAL_DEFAULT_PROFILE).toEqual(originalDefault);
  });

  it("returns a new object (not a reference to any input)", () => {
    const result1 = resolveProfile("blob", "baby", MOVEMENT_PROFILES);
    const result2 = resolveProfile("blob", "baby", MOVEMENT_PROFILES);
    expect(result1).not.toBe(result2);
    expect(result1).toEqual(result2);
  });
});

describe("computeResolvedRestY", () => {
  it("returns groundY - groundOffsetY for grounded movement", () => {
    const profile: MovementProfile = {
      ...GLOBAL_DEFAULT_PROFILE,
      movementStyle: "grounded",
      groundOffsetY: 10,
      hoverOffsetY: 0,
    };
    expect(computeResolvedRestY(500, profile)).toBe(490);
  });

  it("returns groundY - hoverOffsetY for floating movement", () => {
    const profile: MovementProfile = {
      ...GLOBAL_DEFAULT_PROFILE,
      movementStyle: "floating",
      hoverOffsetY: 20,
      groundOffsetY: 0,
    };
    expect(computeResolvedRestY(500, profile)).toBe(480);
  });

  it("returns groundY when offsets are 0", () => {
    const profile: MovementProfile = {
      ...GLOBAL_DEFAULT_PROFILE,
      movementStyle: "grounded",
      groundOffsetY: 0,
      hoverOffsetY: 0,
    };
    expect(computeResolvedRestY(300, profile)).toBe(300);
  });

  it("never exceeds groundY (clamped when offset is negative)", () => {
    const profile: MovementProfile = {
      ...GLOBAL_DEFAULT_PROFILE,
      movementStyle: "grounded",
      groundOffsetY: -5, // negative offset would push below ground
      hoverOffsetY: 0,
    };
    // groundY - (-5) = 305, but clamped to groundY = 300
    expect(computeResolvedRestY(300, profile)).toBe(300);
  });

  it("never exceeds groundY for floating with negative hoverOffset", () => {
    const profile: MovementProfile = {
      ...GLOBAL_DEFAULT_PROFILE,
      movementStyle: "floating",
      hoverOffsetY: -10,
      groundOffsetY: 0,
    };
    // groundY - (-10) = 310, but clamped to groundY = 300
    expect(computeResolvedRestY(300, profile)).toBe(300);
  });

  it("handles groundY of 0", () => {
    const profile: MovementProfile = {
      ...GLOBAL_DEFAULT_PROFILE,
      movementStyle: "floating",
      hoverOffsetY: 12,
    };
    // 0 - 12 = -12, which is ≤ 0, so no clamping needed
    expect(computeResolvedRestY(0, profile)).toBe(-12);
  });

  it("correctly uses frog baby profile (floating with hoverOffsetY 12)", () => {
    const frogBabyProfile = resolveProfile("frog", "baby", MOVEMENT_PROFILES);
    const groundY = 500;
    const restY = computeResolvedRestY(groundY, frogBabyProfile);
    expect(restY).toBe(500 - 12); // 488
    expect(restY).toBeLessThanOrEqual(groundY);
  });
});


