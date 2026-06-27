// src/shared/pet/actionEffectConstants.ts
// User-action benefit constants and autonomous action configuration.
// This module has zero imports — only exports of constants.

// Feed action effects
export const FEED_HUNGER_GAIN = 20;
export const FEED_ENERGY_GAIN = 5;
export const FEED_BOND_GAIN = 2;

// Play action effects
export const PLAY_HAPPINESS_GAIN = 20;
export const PLAY_ENERGY_COST = 10;
export const PLAY_HUNGER_COST = 5;
export const PLAY_BOND_GAIN = 2;

// Clean action effects
export const CLEAN_CLEANLINESS_GAIN = 25;
export const CLEAN_HAPPINESS_GAIN = 5;
export const CLEAN_BOND_GAIN = 2;

// Rest action effects
export const REST_ENERGY_GAIN = 25;
export const REST_HUNGER_COST = 5;
export const REST_BOND_GAIN = 2;

// Autonomous action multiplier (applied to user-action constants for autonomous benefits)
export const AUTONOMOUS_ACTION_BENEFIT_MULTIPLIER = 0.5;

// Autonomous tick interval (ms) — used by renderer overlay controller
export const AUTONOMOUS_TICK_INTERVAL_MS = 5000;
