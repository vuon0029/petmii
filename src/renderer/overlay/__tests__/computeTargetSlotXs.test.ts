import { describe, it, expect } from "vitest";
import { computeTargetSlotXs } from "../cursorAttractionController";

describe("computeTargetSlotXs", () => {
  const PET_SIZE = 48;
  const SPACING = 60;

  describe("basic slot generation", () => {
    it("returns a single slot at cursorX when petCount is 1", () => {
      const result = computeTargetSlotXs(500, 1, SPACING, 1000, PET_SIZE);
      expect(result).toEqual([500]);
    });

    it("returns 2 slots with correct offset pattern for petCount 2", () => {
      // offsets: [0, -60] → positions: [500, 440]
      const result = computeTargetSlotXs(500, 2, SPACING, 1000, PET_SIZE);
      expect(result).toEqual([500, 440]);
    });

    it("returns 3 slots with correct offset pattern for petCount 3", () => {
      // offsets: [0, -60, +60] → positions: [500, 440, 560]
      const result = computeTargetSlotXs(500, 3, SPACING, 1000, PET_SIZE);
      expect(result).toEqual([500, 440, 560]);
    });

    it("returns 5 slots with correct offset pattern for petCount 5", () => {
      // offsets: [0, -60, +60, -120, +120] → positions: [500, 440, 560, 380, 620]
      const result = computeTargetSlotXs(500, 5, SPACING, 1000, PET_SIZE);
      expect(result).toEqual([500, 440, 560, 380, 620]);
    });

    it("slot at index 0 is the center-most (closest to cursorX)", () => {
      const result = computeTargetSlotXs(500, 3, SPACING, 1000, PET_SIZE);
      expect(result[0]).toBe(500); // center slot is cursorX itself
    });
  });

  describe("viewport clamping - shift as a unit", () => {
    it("shifts group right when left-most slot would go below 0", () => {
      // cursorX=30, petCount=3, spacing=60, viewport=1000, petSize=48
      // offsets: [0, -60, +60] → raw positions: [30, -30, 90]
      // minPos=-30, shift right by 30 → [60, 0, 120]
      const result = computeTargetSlotXs(30, 3, SPACING, 1000, PET_SIZE);
      expect(result[0]).toBe(60);
      expect(result[1]).toBe(0);
      expect(result[2]).toBe(120);
      // All within bounds [0, 952]
      result.forEach((pos) => {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThanOrEqual(1000 - PET_SIZE);
      });
    });

    it("shifts group left when right-most slot would exceed viewport", () => {
      // cursorX=940, petCount=3, spacing=60, viewport=1000, petSize=48
      // maxX = 952
      // offsets: [0, -60, +60] → raw positions: [940, 880, 1000]
      // maxPos=1000 > 952, shift left by 48 → [892, 832, 952]
      const result = computeTargetSlotXs(940, 3, SPACING, 1000, PET_SIZE);
      result.forEach((pos) => {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThanOrEqual(1000 - PET_SIZE);
      });
      // Spacing preserved
      const sorted = [...result].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i] - sorted[i - 1]).toBe(SPACING);
      }
    });

    it("preserves inter-slot spacing after shifting", () => {
      const result = computeTargetSlotXs(20, 3, SPACING, 1000, PET_SIZE);
      const sorted = [...result].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i] - sorted[i - 1]).toBe(SPACING);
      }
    });
  });

  describe("narrow viewport - fewer slots returned", () => {
    it("returns fewer slots when viewport cannot fit all requested", () => {
      // viewportWidth=100, petSize=48, spacing=60
      // maxFittingCount = Math.floor((100-48)/60) + 1 = Math.floor(0.867) + 1 = 1
      const result = computeTargetSlotXs(50, 3, SPACING, 100, PET_SIZE);
      expect(result.length).toBeLessThan(3);
      expect(result.length).toBe(1);
    });

    it("returns 2 slots when viewport fits exactly 2", () => {
      // Need: Math.floor((vw - petSize) / spacing) + 1 = 2
      // (vw - 48) / 60 >= 1 and < 2 → vw >= 108 and < 168
      const result = computeTargetSlotXs(60, 5, SPACING, 120, PET_SIZE);
      expect(result.length).toBe(2);
    });

    it("all returned slots are within viewport bounds", () => {
      const result = computeTargetSlotXs(50, 5, SPACING, 120, PET_SIZE);
      const maxX = 120 - PET_SIZE;
      result.forEach((pos) => {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThanOrEqual(maxX);
      });
    });
  });

  describe("edge cases", () => {
    it("returns empty array when petCount is 0", () => {
      expect(computeTargetSlotXs(500, 0, SPACING, 1000, PET_SIZE)).toEqual([]);
    });

    it("returns empty array when spacing is 0", () => {
      expect(computeTargetSlotXs(500, 3, 0, 1000, PET_SIZE)).toEqual([]);
    });

    it("returns empty array when viewportWidth equals petSize", () => {
      expect(computeTargetSlotXs(0, 3, SPACING, PET_SIZE, PET_SIZE)).toEqual(
        []
      );
    });

    it("returns empty array when viewportWidth is less than petSize", () => {
      expect(computeTargetSlotXs(0, 3, SPACING, 30, PET_SIZE)).toEqual([]);
    });
  });
});
