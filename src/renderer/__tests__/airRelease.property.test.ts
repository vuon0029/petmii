import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeReleaseOutcome } from "../overlay/computeReleaseOutcome";

// ─── Property 1: Bug Condition (from Task 1) ───
// This is the exploration test that FAILS on unfixed code.
// Included here for completeness but marked separately.

describe("Property 1: Bug Condition - Air Release Triggers Falling Physics", () => {
  it("should enter flying state when released high above rest with low velocity (EXPECTED TO FAIL on unfixed code)", () => {
    const AIR_RELEASE_THRESHOLD_PX = 40;

    fc.assert(
      fc.property(
        fc.record({
          resolvedRestY: fc.integer({ min: 200, max: 800 }),
          petY: fc.integer({ min: 0, max: 759 }),
          vx: fc.double({ min: -2, max: 2, noNaN: true }),
          vy: fc.double({ min: -2, max: 2, noNaN: true }),
        }).filter(({ resolvedRestY, petY }) => resolvedRestY - petY > AIR_RELEASE_THRESHOLD_PX),
        (input) => {
          const result = computeReleaseOutcome(input);

          // Expected behavior (after fix): pet should enter flying state
          expect(result.physicsState).toBe("flying");
          expect(result.vx).toBe(0);
          expect(result.vy).toBe(0);
          expect(result.y).toBe(input.petY); // stays at release position
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 2: Preservation - Ground-Level and Thrown Releases Unchanged ───
// These tests encode EXISTING behavior that must be preserved after the fix.
// They should PASS on the current unfixed code.

describe("Property 2: Preservation - Ground-Level and Thrown Releases Unchanged", () => {
  /**
   * Validates: Requirements 3.1, 3.4
   *
   * Preservation A: Ground-Level Release
   * For all inputs where abs(vx) <= 2 AND abs(vy) <= 2 AND (resolvedRestY - petY) <= 40:
   * assert physicsState="idle", y=resolvedRestY, vx=0, vy=0, angularVel=0, rotation=0
   */
  it("Preservation A: Ground-level release snaps to idle at resolvedRestY", () => {
    const AIR_RELEASE_THRESHOLD_PX = 40;

    fc.assert(
      fc.property(
        fc.record({
          resolvedRestY: fc.integer({ min: 200, max: 800 }),
          vx: fc.double({ min: -2, max: 2, noNaN: true }),
          vy: fc.double({ min: -2, max: 2, noNaN: true }),
        }).chain(({ resolvedRestY, vx, vy }) =>
          fc.record({
            resolvedRestY: fc.constant(resolvedRestY),
            vx: fc.constant(vx),
            vy: fc.constant(vy),
            // petY within AIR_RELEASE_THRESHOLD_PX of resolvedRestY (i.e., resolvedRestY - petY <= 40)
            petY: fc.integer({ min: resolvedRestY - AIR_RELEASE_THRESHOLD_PX, max: resolvedRestY }),
          }),
        ),
        (input) => {
          const result = computeReleaseOutcome(input);

          // Ground-level release: snaps to idle at resolvedRestY
          expect(result.physicsState).toBe("idle");
          expect(result.y).toBe(input.resolvedRestY);
          expect(result.vx).toBe(0);
          expect(result.vy).toBe(0);
          expect(result.angularVel).toBe(0);
          expect(result.rotation).toBe(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Validates: Requirements 3.1, 3.7, 3.8
   *
   * Preservation B: High-Velocity Throw
   * For all inputs where abs(vx) > 2 OR abs(vy) > 2:
   * assert physicsState="flying", vx=clamp(vx, -15, 15), vy=clamp(vy, -15, 15), angularVel=clampedVx * 0.03
   */
  it("Preservation B: High-velocity throw enters flying with capped velocity", () => {
    // Generate inputs where at least one velocity component exceeds the throw threshold
    const highVelocityArb = fc.oneof(
      // Case 1: abs(vx) > 2
      fc.record({
        resolvedRestY: fc.integer({ min: 200, max: 800 }),
        petY: fc.integer({ min: 0, max: 800 }),
        vx: fc.oneof(
          fc.double({ min: 2.01, max: 30, noNaN: true }),
          fc.double({ min: -30, max: -2.01, noNaN: true }),
        ),
        vy: fc.double({ min: -30, max: 30, noNaN: true }),
      }),
      // Case 2: abs(vy) > 2
      fc.record({
        resolvedRestY: fc.integer({ min: 200, max: 800 }),
        petY: fc.integer({ min: 0, max: 800 }),
        vx: fc.double({ min: -30, max: 30, noNaN: true }),
        vy: fc.oneof(
          fc.double({ min: 2.01, max: 30, noNaN: true }),
          fc.double({ min: -30, max: -2.01, noNaN: true }),
        ),
      }),
    ).filter(({ vx, vy }) => Math.abs(vx) > 2 || Math.abs(vy) > 2);

    fc.assert(
      fc.property(highVelocityArb, (input) => {
        const result = computeReleaseOutcome(input);

        const expectedVx = Math.max(-15, Math.min(15, input.vx));
        const expectedVy = Math.max(-15, Math.min(15, input.vy));
        const expectedAngularVel = expectedVx * 0.03;

        // High-velocity throw: enters flying with capped velocity
        expect(result.physicsState).toBe("flying");
        expect(result.vx).toBeCloseTo(expectedVx, 10);
        expect(result.vy).toBeCloseTo(expectedVy, 10);
        expect(result.angularVel).toBeCloseTo(expectedAngularVel, 10);
      }),
      { numRuns: 200 },
    );
  });
});
