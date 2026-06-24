// src/shared/pet/actionTypes.ts
// Shared action types for the pet cooldown system.
// This module has zero imports — only exports of types.

/** User-triggered action types */
export type UserActionType = 'feed' | 'play' | 'clean' | 'rest';

/** Per-pet cooldown state — persisted alongside PetState */
export interface PetActionCooldowns {
  feed?: number;   // CooldownUntil timestamp (ms since epoch)
  play?: number;
  rest?: number;
  clean?: number;
}

/** Stat keys affected by actions */
export type PetStatKey = 'hunger' | 'happiness' | 'energy' | 'cleanliness' | 'bond';
