import type { UserActionType } from './actionTypes';

// Cooldown durations (ms) per user action
export const FEED_COOLDOWN_MS = 300_000; // 5 min
export const PLAY_COOLDOWN_MS = 600_000; // 10 min
export const CLEAN_COOLDOWN_MS = 900_000; // 15 min
export const REST_COOLDOWN_MS = 1_200_000; // 20 min

// Action-to-cooldown mapping
export const ACTION_COOLDOWN_MAP: Record<UserActionType, number> = {
  feed: FEED_COOLDOWN_MS,
  play: PLAY_COOLDOWN_MS,
  clean: CLEAN_COOLDOWN_MS,
  rest: REST_COOLDOWN_MS,
};
