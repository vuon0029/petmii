import type { PhysicsState } from "./actionScheduler";

/**
 * Threshold in pixels above resolvedRestY that triggers falling physics
 * instead of instant snap-to-rest on a low-velocity release.
 */
export const AIR_RELEASE_THRESHOLD_PX = 40;

const ANGULAR_VEL_FACTOR = 0.03;

export interface ReleaseInput {
  petY: number;
  resolvedRestY: number;
  vx: number;
  vy: number;
}

export interface ReleaseOutcome {
  physicsState: PhysicsState;
  y: number;
  vx: number;
  vy: number;
  angularVel: number;
  rotation: number;
}

/**
 * Pure function that replicates the release-decision logic from handleMouseUp.
 * Given a pet's current Y position, its resolved rest Y, and the computed release
 * velocities, determines what physics state and position the pet should transition to.
 *
 * This includes the air-release height check fix: if the pet is more than
 * AIR_RELEASE_THRESHOLD_PX above resolvedRestY with low velocity, it enters
 * "flying" state with zero velocity so gravity pulls it down naturally.
 */
export function computeReleaseOutcome(input: ReleaseInput): ReleaseOutcome {
  const { petY, resolvedRestY, vx, vy } = input;

  const isThrown = Math.abs(vx) > 2 || Math.abs(vy) > 2;

  // Cap velocity to prevent extreme throws
  const cappedVx = Math.max(-15, Math.min(15, vx));
  const cappedVy = Math.max(-15, Math.min(15, vy));

  if (!isThrown) {
    const heightAboveRest = resolvedRestY - petY;

    if (heightAboveRest > AIR_RELEASE_THRESHOLD_PX) {
      // Air release — enter flying with zero velocity, gravity does the rest
      return {
        physicsState: "flying",
        y: petY,
        vx: 0,
        vy: 0,
        angularVel: 0,
        rotation: 0,
      };
    } else {
      // Ground-level release — snap to rest (existing behavior)
      return {
        physicsState: "idle",
        y: resolvedRestY,
        vx: 0,
        vy: 0,
        angularVel: 0,
        rotation: 0,
      };
    }
  } else {
    // High velocity — enter throw flight
    const angularVel = cappedVx * ANGULAR_VEL_FACTOR;
    return {
      physicsState: "flying",
      y: petY,
      vx: cappedVx,
      vy: cappedVy,
      angularVel,
      rotation: 0, // rotation is not reset on throw, but we include it for completeness
    };
  }
}
