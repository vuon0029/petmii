import { describe, it, expect } from "vitest";
import { getEvolutionReadiness, type EvolutionReadinessInput } from "./evolutionReadiness";
import { SPECIES_STAGE_THRESHOLDS } from "./lifeStageThresholds";

describe("getEvolutionReadiness", () => {
  const baseTime = 1700000000000; // fixed reference timestamp

  it("returns not ready for adult pets", () => {
    const pet: EvolutionReadinessInput = {
      species: "blob",
      lifeStage: "adult",
      hatchedAt: baseTime - 100 * 60 * 60 * 1000,
    };
    const result = getEvolutionReadiness(pet, baseTime);
    expect(result).toEqual({ isReady: false, nextStage: null, remainingHours: null });
  });

  it("returns ready for baby when elapsed >= babyToChild threshold", () => {
    const thresholds = SPECIES_STAGE_THRESHOLDS["blob"];
    const elapsedMs = thresholds.babyToChild * 60 * 60 * 1000;
    const pet: EvolutionReadinessInput = {
      species: "blob",
      lifeStage: "baby",
      hatchedAt: baseTime - elapsedMs,
    };
    const result = getEvolutionReadiness(pet, baseTime);
    expect(result).toEqual({ isReady: true, nextStage: "child", remainingHours: null });
  });

  it("returns not ready for baby when elapsed < babyToChild threshold", () => {
    const thresholds = SPECIES_STAGE_THRESHOLDS["blob"];
    const elapsedMs = (thresholds.babyToChild / 2) * 60 * 60 * 1000;
    const pet: EvolutionReadinessInput = {
      species: "blob",
      lifeStage: "baby",
      hatchedAt: baseTime - elapsedMs,
    };
    const result = getEvolutionReadiness(pet, baseTime);
    expect(result.isReady).toBe(false);
    expect(result.nextStage).toBe("child");
    expect(result.remainingHours).toBeCloseTo(thresholds.babyToChild / 2);
  });

  it("returns ready for child when elapsed >= cumulative threshold", () => {
    const thresholds = SPECIES_STAGE_THRESHOLDS["frog"];
    const cumulativeHours = thresholds.babyToChild + thresholds.childToAdult;
    const elapsedMs = cumulativeHours * 60 * 60 * 1000;
    const pet: EvolutionReadinessInput = {
      species: "frog",
      lifeStage: "child",
      hatchedAt: baseTime - elapsedMs,
    };
    const result = getEvolutionReadiness(pet, baseTime);
    expect(result).toEqual({ isReady: true, nextStage: "adult", remainingHours: null });
  });

  it("returns not ready for child when elapsed < cumulative threshold", () => {
    const thresholds = SPECIES_STAGE_THRESHOLDS["frog"];
    const cumulativeHours = thresholds.babyToChild + thresholds.childToAdult;
    const halfwayMs = (cumulativeHours / 2) * 60 * 60 * 1000;
    const pet: EvolutionReadinessInput = {
      species: "frog",
      lifeStage: "child",
      hatchedAt: baseTime - halfwayMs,
    };
    const result = getEvolutionReadiness(pet, baseTime);
    expect(result.isReady).toBe(false);
    expect(result.nextStage).toBe("adult");
    expect(result.remainingHours).toBeCloseTo(cumulativeHours / 2);
  });

  it("defaults now to Date.now() when not provided", () => {
    const pet: EvolutionReadinessInput = {
      species: "blob",
      lifeStage: "baby",
      hatchedAt: 0, // very old pet
    };
    const result = getEvolutionReadiness(pet);
    expect(result.isReady).toBe(true);
    expect(result.nextStage).toBe("child");
  });
});
