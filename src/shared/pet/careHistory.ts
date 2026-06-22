// src/shared/pet/careHistory.ts
// Pure types and functions for care history tracking.
// This module lives in src/shared/pet/ — must NOT import from src/renderer/.

/** Tracked care action types */
export type CareAction =
  | "feed"
  | "play"
  | "rest"
  | "clean"
  | "pickedUp"
  | "throw"
  | "gentleThrow"
  | "hardThrow";

/** Integer counts for each action */
export type CareCounts = Record<CareAction, number>;

/** Per-stage breakdown */
export type PerStageCounts = Record<"baby" | "child" | "adult", CareCounts>;

/** Cooldown metadata persisted to disk */
export interface CareCountMetadata {
  pickedUpLastCountedAt: string | null; // ISO timestamp
}

/** Full care history record attached to PetState */
export interface CareHistory {
  lifetime: CareCounts;
  perStage: PerStageCounts;
  metadata: CareCountMetadata;
}

/** Adult traits */
export type AdultTrait =
  | "Playful"
  | "Affectionate"
  | "Sleepy"
  | "Chaotic"
  | "Classic";

/** Lifecycle state — runtime only, never persisted */
export type LifecycleState = "normal" | "evolving";

// --- Pure functions ---

/** Creates a default empty CareCounts with all zeros */
function createZeroCounts(): CareCounts {
  return {
    feed: 0,
    play: 0,
    rest: 0,
    clean: 0,
    pickedUp: 0,
    throw: 0,
    gentleThrow: 0,
    hardThrow: 0,
  };
}

/** Creates a default empty CareHistory with all-zero counts */
export function createDefaultCareHistory(): CareHistory {
  return {
    lifetime: createZeroCounts(),
    perStage: {
      baby: createZeroCounts(),
      child: createZeroCounts(),
      adult: createZeroCounts(),
    },
    metadata: {
      pickedUpLastCountedAt: null,
    },
  };
}

/**
 * Increments a care action in both lifetime and current stage counts.
 * Returns a new CareHistory — does not mutate the input.
 */
export function incrementCareAction(
  history: CareHistory,
  action: CareAction,
  currentStage: "baby" | "child" | "adult"
): CareHistory {
  return {
    ...history,
    lifetime: {
      ...history.lifetime,
      [action]: history.lifetime[action] + 1,
    },
    perStage: {
      ...history.perStage,
      [currentStage]: {
        ...history.perStage[currentStage],
        [action]: history.perStage[currentStage][action] + 1,
      },
    },
  };
}

/**
 * Returns the careHistory if defined, otherwise creates a default empty one.
 */
export function ensureCareHistory(
  careHistory: CareHistory | undefined
): CareHistory {
  return careHistory ?? createDefaultCareHistory();
}
