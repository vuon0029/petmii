// src/main/actionValidator.ts
// Pure validation and effect-application logic for user actions.
// This module does NOT import from petStorage, does NOT broadcast, does NOT save.
// The IPC handler calls these functions and handles I/O separately.

import type { UserActionType } from '../shared/pet/actionTypes';
import type { PetState } from '../renderer/pet/petVariant';
import { getCooldownRemainingMs, sanitizeCooldowns, setCooldown } from '../shared/pet/cooldownUtils';
import { ACTION_COOLDOWN_MAP } from '../shared/pet/actionCooldownConstants';
import {
  FEED_HUNGER_GAIN,
  FEED_ENERGY_GAIN,
  FEED_BOND_GAIN,
  PLAY_HAPPINESS_GAIN,
  PLAY_ENERGY_COST,
  PLAY_HUNGER_COST,
  PLAY_BOND_GAIN,
  CLEAN_CLEANLINESS_GAIN,
  CLEAN_HAPPINESS_GAIN,
  CLEAN_BOND_GAIN,
  REST_ENERGY_GAIN,
  REST_HUNGER_COST,
  REST_BOND_GAIN,
} from '../shared/pet/actionEffectConstants';
import { ACTION_STAT_MAP, STAT_MAXED_LABELS } from '../shared/pet/actionMappings';
import { incrementCareAction, ensureCareHistory } from '../shared/pet/careHistory';

// --- Exported Types ---

export type ReasonCode = 'PET_BUSY' | 'ACTION_ON_COOLDOWN' | 'STAT_ALREADY_MAXED';

export interface PetActionAvailability {
  available: boolean;
  reasonCode?: ReasonCode;
  message?: string;
  cooldownUntil?: number | null;
  cooldownRemainingMs?: number | null;
}

export interface ActionRequest {
  petId: string;
  action: UserActionType;
}

// --- Helper ---

/**
 * Clamps a numeric value between min and max (inclusive).
 * Defaults: min = 0, max = 100.
 */
export function clamp(value: number, min: number = 0, max: number = 100): number {
  return Math.min(max, Math.max(min, value));
}

// --- Pure Validation ---

/**
 * Pure availability check. Does NOT mutate state or perform I/O.
 * Checks in Display_Priority order: busy → cooldown → stat-maxed.
 */
export function getPetActionAvailability(
  pet: PetState,
  action: UserActionType,
  isBusy: boolean,
  now: number = Date.now()
): PetActionAvailability {
  // Priority 1: Busy check
  if (isBusy) {
    return {
      available: false,
      reasonCode: 'PET_BUSY',
      message: `${pet.name} is busy right now`,
      cooldownUntil: null,
      cooldownRemainingMs: null,
    };
  }

  // Priority 2: Cooldown check
  const cooldowns = sanitizeCooldowns((pet as unknown as Record<string, unknown>).actionCooldowns);
  const remaining = getCooldownRemainingMs(cooldowns, action, now);
  if (remaining > 0) {
    return {
      available: false,
      reasonCode: 'ACTION_ON_COOLDOWN',
      message: `${action} is on cooldown`,
      cooldownUntil: cooldowns[action]!,
      cooldownRemainingMs: remaining,
    };
  }

  // Priority 3: Stat-maxed check
  const statKey = ACTION_STAT_MAP[action];
  if (pet[statKey] >= 100) {
    return {
      available: false,
      reasonCode: 'STAT_ALREADY_MAXED',
      message: STAT_MAXED_LABELS[action],
      cooldownUntil: null,
      cooldownRemainingMs: null,
    };
  }

  return { available: true };
}

// --- Effect Application ---

/**
 * Applies user-action effects to a pet object (mutation).
 * Sets stat changes, updates lastXAt timestamp, sets cooldown.
 * Increments careHistory count for the action.
 * Clamps all stats to [0, 100].
 * Does NOT perform I/O (no save, no broadcast).
 */
export function applyUserAction(
  pet: PetState,
  action: UserActionType,
  now: number = Date.now()
): void {
  const timestamp = new Date(now).toISOString();
  const cooldowns = sanitizeCooldowns((pet as unknown as Record<string, unknown>).actionCooldowns);

  // Apply stat effects per action
  switch (action) {
    case 'feed':
      pet.hunger = clamp(pet.hunger + FEED_HUNGER_GAIN);
      pet.energy = clamp(pet.energy + FEED_ENERGY_GAIN);
      pet.bond = clamp(pet.bond + FEED_BOND_GAIN);
      pet.lastFedAt = timestamp;
      break;
    case 'play':
      pet.happiness = clamp(pet.happiness + PLAY_HAPPINESS_GAIN);
      pet.energy = clamp(pet.energy - PLAY_ENERGY_COST);
      pet.hunger = clamp(pet.hunger - PLAY_HUNGER_COST);
      pet.bond = clamp(pet.bond + PLAY_BOND_GAIN);
      pet.lastPlayedAt = timestamp;
      break;
    case 'clean':
      pet.cleanliness = clamp(pet.cleanliness + CLEAN_CLEANLINESS_GAIN);
      pet.happiness = clamp(pet.happiness + CLEAN_HAPPINESS_GAIN);
      pet.bond = clamp(pet.bond + CLEAN_BOND_GAIN);
      pet.lastCleanedAt = timestamp;
      break;
    case 'rest':
      pet.energy = clamp(pet.energy + REST_ENERGY_GAIN);
      pet.hunger = clamp(pet.hunger - REST_HUNGER_COST);
      pet.bond = clamp(pet.bond + REST_BOND_GAIN);
      pet.lastRestedAt = timestamp;
      break;
  }

  // Increment careHistory
  const history = ensureCareHistory(pet.careHistory);
  pet.careHistory = incrementCareAction(history, action, pet.lifeStage as 'baby' | 'child' | 'adult');

  // Set cooldown
  (pet as unknown as Record<string, unknown>).actionCooldowns = setCooldown(cooldowns, action, ACTION_COOLDOWN_MAP[action], now);

  // Update updatedAt timestamp
  pet.updatedAt = timestamp;
}
