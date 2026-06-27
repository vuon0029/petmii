import type { UserActionType, PetActionCooldowns } from './actionTypes';

/**
 * Returns remaining cooldown in ms (0 if expired/not set).
 */
export function getCooldownRemainingMs(
  cooldowns: PetActionCooldowns,
  action: UserActionType,
  now: number = Date.now()
): number {
  const until = cooldowns[action];
  if (until === undefined) return 0;
  return Math.max(0, until - now);
}

/**
 * Returns true if the action is currently on cooldown.
 */
export function isActionOnCooldown(
  cooldowns: PetActionCooldowns,
  action: UserActionType,
  now: number = Date.now()
): boolean {
  return getCooldownRemainingMs(cooldowns, action, now) > 0;
}

/**
 * Sets the cooldown for an action. Returns new PetActionCooldowns (immutable).
 */
export function setCooldown(
  cooldowns: PetActionCooldowns,
  action: UserActionType,
  durationMs: number,
  now: number = Date.now()
): PetActionCooldowns {
  return { ...cooldowns, [action]: now + durationMs };
}

/**
 * Sanitizes loaded cooldowns: discards non-finite/negative/zero values.
 */
export function sanitizeCooldowns(raw: unknown): PetActionCooldowns {
  if (!raw || typeof raw !== 'object') return {};
  const result: PetActionCooldowns = {};
  for (const key of ['feed', 'play', 'rest', 'clean'] as const) {
    const val = (raw as Record<string, unknown>)[key];
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      result[key] = val;
    }
  }
  return result;
}
