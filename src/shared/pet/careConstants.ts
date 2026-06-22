// src/shared/pet/careConstants.ts
// All tuning constants for the care history and trait scoring system.
// This module has zero imports — only exports of constants.

/** Minimum difference between top trait score and second-highest for non-Classic assignment */
export const DOMINANCE_MARGIN = 3;

/** Minimum total relevant activity count required for any non-Classic trait */
export const MIN_ACTIVITY_THRESHOLD = 5;

/** Fractional weight of gentleThrow count added to play and pickedUp scores */
export const GENTLE_THROW_WEIGHT = 0.5;

/** Minimum release speed for a throw to be counted as a throw action */
export const THROW_SPEED_THRESHOLD = 2;

/** Minimum release speed for a throw to be counted as a hard throw */
export const HARD_THROW_SPEED_THRESHOLD = 9;

/** Minimum interval (ms) between successive pickedUp history counts for one pet */
export const PICKED_UP_HISTORY_COOLDOWN_MS = 30000;
