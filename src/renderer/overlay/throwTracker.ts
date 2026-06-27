// src/renderer/overlay/throwTracker.ts
// Throw sequence tracking for care history.
// Classifies releases by speed and handles idempotent wall collision counting.

import {
  THROW_SPEED_THRESHOLD,
  HARD_THROW_SPEED_THRESHOLD,
} from "../../shared/pet/careConstants";
import type { CareAction } from "../../shared/pet/careHistory";

export interface ThrowSequenceState {
  active: boolean;
  petId: string;
  hardThrowCounted: boolean;
  gentleThrowCounted: boolean;
  throwCounted: boolean;
}

/**
 * Called at drag release. Classifies the throw by speed and returns which
 * CareActions to increment.
 *
 * - speed < THROW_SPEED_THRESHOLD: no throw actions (pickedUp was already counted at drag start)
 * - THROW_SPEED_THRESHOLD <= speed < HARD_THROW_SPEED_THRESHOLD: ["throw", "gentleThrow"]
 * - speed >= HARD_THROW_SPEED_THRESHOLD: ["throw", "hardThrow"]
 */
export function classifyRelease(speed: number): { actions: CareAction[] } {
  if (speed < THROW_SPEED_THRESHOLD) {
    return { actions: [] };
  }
  if (speed < HARD_THROW_SPEED_THRESHOLD) {
    return { actions: ["throw", "gentleThrow"] };
  }
  return { actions: ["throw", "hardThrow"] };
}

/**
 * Called on wall collision during flying state.
 * Returns whether to increment hardThrow (only if not already counted in this sequence).
 * Idempotent — subsequent calls after the first are no-ops.
 */
export function onWallCollision(
  state: ThrowSequenceState
): { incrementHardThrow: boolean; updatedState: ThrowSequenceState } {
  if (state.hardThrowCounted) {
    return { incrementHardThrow: false, updatedState: state };
  }
  return {
    incrementHardThrow: true,
    updatedState: { ...state, hardThrowCounted: true },
  };
}

/**
 * Creates a fresh ThrowSequenceState for a new throw sequence.
 */
export function createThrowSequenceState(petId: string): ThrowSequenceState {
  return {
    active: true,
    petId,
    hardThrowCounted: false,
    gentleThrowCounted: false,
    throwCounted: false,
  };
}
