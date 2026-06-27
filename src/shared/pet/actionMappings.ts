import type { UserActionType, PetStatKey } from './actionTypes';

// Action-to-stat mapping for max-check
export const ACTION_STAT_MAP: Record<UserActionType, PetStatKey> = {
  feed: 'hunger',
  play: 'happiness',
  clean: 'cleanliness',
  rest: 'energy',
};

// Stat-maxed display labels
export const STAT_MAXED_LABELS: Record<UserActionType, string> = {
  feed: 'Full',
  play: 'Happy',
  clean: 'Clean',
  rest: 'Rested',
};

// Action display labels
export const ACTION_LABELS: Record<UserActionType, string> = {
  feed: 'Feed',
  play: 'Play',
  clean: 'Clean',
  rest: 'Rest',
};
