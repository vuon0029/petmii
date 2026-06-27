// src/main/autonomousBenefits.ts
// Applies stat benefits for autonomous actions (autonomousRest, playTogether).
//
// These functions:
// - Do NOT increment careHistory
// - Do NOT set any cooldowns
// - Do NOT read or write PetActionCooldowns
//
// Autonomous benefits are derived from user-action constants × AUTONOMOUS_ACTION_BENEFIT_MULTIPLIER.

import type { PetState } from '../renderer/pet/petVariant';
import {
  AUTONOMOUS_ACTION_BENEFIT_MULTIPLIER,
  REST_ENERGY_GAIN,
  REST_HUNGER_COST,
  REST_BOND_GAIN,
  PLAY_HAPPINESS_GAIN,
  PLAY_ENERGY_COST,
  PLAY_HUNGER_COST,
  PLAY_BOND_GAIN,
} from '../shared/pet/actionEffectConstants';
import { clamp } from './actionValidator';

/**
 * Applies autonomousRest stat benefits to a pet (mutation).
 * Uses REST_* constants × AUTONOMOUS_ACTION_BENEFIT_MULTIPLIER.
 *
 * Effects:
 * - energy += Math.round(REST_ENERGY_GAIN × 0.5) = 13
 * - hunger -= Math.round(REST_HUNGER_COST × 0.5) = 3
 * - bond += Math.round(REST_BOND_GAIN × 0.5) = 1
 *
 * All stats clamped to [0, 100].
 *
 * Does NOT increment careHistory.
 * Does NOT set any cooldowns.
 * Does NOT read or write PetActionCooldowns.
 */
export function applyAutonomousRestBenefits(pet: PetState): void {
  pet.energy = clamp(pet.energy + Math.round(REST_ENERGY_GAIN * AUTONOMOUS_ACTION_BENEFIT_MULTIPLIER));
  pet.hunger = clamp(pet.hunger - Math.round(REST_HUNGER_COST * AUTONOMOUS_ACTION_BENEFIT_MULTIPLIER));
  pet.bond = clamp(pet.bond + Math.round(REST_BOND_GAIN * AUTONOMOUS_ACTION_BENEFIT_MULTIPLIER));
  // NO careHistory increment
  // NO cooldown set
}

/**
 * Applies playTogether stat benefits to a pet (mutation).
 * Uses PLAY_* constants × AUTONOMOUS_ACTION_BENEFIT_MULTIPLIER.
 *
 * Effects:
 * - happiness += Math.round(PLAY_HAPPINESS_GAIN × 0.5) = 10
 * - energy -= Math.round(PLAY_ENERGY_COST × 0.5) = 5
 * - hunger -= Math.round(PLAY_HUNGER_COST × 0.5) = 3
 * - bond += Math.round(PLAY_BOND_GAIN × 0.5) = 1
 *
 * All stats clamped to [0, 100].
 *
 * Does NOT increment careHistory.
 * Does NOT set any cooldowns.
 * Does NOT read or write PetActionCooldowns.
 */
export function applyPlayTogetherBenefits(pet: PetState): void {
  pet.happiness = clamp(pet.happiness + Math.round(PLAY_HAPPINESS_GAIN * AUTONOMOUS_ACTION_BENEFIT_MULTIPLIER));
  pet.energy = clamp(pet.energy - Math.round(PLAY_ENERGY_COST * AUTONOMOUS_ACTION_BENEFIT_MULTIPLIER));
  pet.hunger = clamp(pet.hunger - Math.round(PLAY_HUNGER_COST * AUTONOMOUS_ACTION_BENEFIT_MULTIPLIER));
  pet.bond = clamp(pet.bond + Math.round(PLAY_BOND_GAIN * AUTONOMOUS_ACTION_BENEFIT_MULTIPLIER));
  // NO careHistory increment
  // NO cooldown set
}
