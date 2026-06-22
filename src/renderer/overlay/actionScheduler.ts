/**
 * Action Scheduler
 *
 * Replaces the hard-coded `triggerHop` with a generic action dispatch system.
 * Reads the resolved movement profile to select actions based on configured
 * intervals and weights, with guards for physics and action state.
 */

import { MovementProfile, ActionName, AmbientActionName } from "./movementProfiles";

/** Debug logging toggle — set to true to log action selection in tick() */
export const ACTION_SCHEDULER_DEBUG = false;

/**
 * Physics state representing drag/throw interaction.
 * Tracked separately from currentAction.
 */
export type PhysicsState =
  | "idle"
  | "dragging"
  | "flying"
  | "landed"
  | "gettingUp";

/** Minimum duration in ms when profile duration is 0 or negative */
const MIN_DURATION_MS = 100;

/** Minimum interval in ms when profile interval is 0 or negative */
const MIN_INTERVAL_MS = 1000;

export interface ActionSchedulerState {
  timerId: ReturnType<typeof setInterval> | null;
  petId: string;
}

/**
 * Creates an action scheduler that periodically selects and dispatches
 * actions from the pet's resolved movement profile.
 *
 * The scheduler:
 * - Reads `interval` from the resolved profile (clamped to MIN_INTERVAL_MS)
 * - On each tick, checks guards (physicsState === "idle" && currentAction === "idle")
 * - Selects an action from `eligibleActions` based on `actionWeights`
 * - Calls `dispatchAction(selectedAction)`
 * - After `duration + landingPauseMs` ms, dispatches "idle" to reset
 */
export function createActionScheduler(
  petId: string,
  getProfile: () => MovementProfile,
  getPhysicsState: () => PhysicsState,
  getCurrentAction: () => ActionName,
  dispatchAction: (action: ActionName) => void
): ActionSchedulerState {
  const state: ActionSchedulerState = {
    timerId: null,
    petId,
  };

  const profile = getProfile();
  const interval = Math.max(profile.interval, MIN_INTERVAL_MS);

  state.timerId = setInterval(() => {
    tick(petId, getProfile, getPhysicsState, getCurrentAction, dispatchAction);
  }, interval);

  return state;
}

/**
 * Destroys an action scheduler, clearing its interval timer.
 */
export function destroyActionScheduler(state: ActionSchedulerState): void {
  if (state.timerId !== null) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

/**
 * A single scheduler tick. Checks guards, selects an action, dispatches it,
 * and schedules the auto-reset to idle after the action's total active time.
 */
function tick(
  petId: string,
  getProfile: () => MovementProfile,
  getPhysicsState: () => PhysicsState,
  getCurrentAction: () => ActionName,
  dispatchAction: (action: ActionName) => void
): void {
  // Guard: only dispatch when both physics and action are idle
  if (getPhysicsState() !== "idle" || getCurrentAction() !== "idle") {
    return;
  }

  const profile = getProfile();
  const action = selectAction(profile);

  // If no action selected (empty eligibleActions or all weights sum to 0), stay idle
  if (action === null) {
    return;
  }

  // Debug logging in tick() where petId is available
  if (ACTION_SCHEDULER_DEBUG) {
    console.log(
      `[ActionScheduler] petId=${petId}`,
      `eligibleActions=${JSON.stringify(profile.eligibleActions)}`,
      `weights=${JSON.stringify(profile.actionWeights)}`,
      `selected=${action}`
    );
  }

  // If "idle" is selected, treat as no-op — leave pet in idle state
  if (action === "idle") {
    return;
  }

  // Dispatch the selected action
  dispatchAction(action);

  // Schedule auto-reset to idle after duration + landingPauseMs
  const duration = Math.max(profile.duration, MIN_DURATION_MS);
  const landingPauseMs = Math.max(profile.landingPauseMs, 0);
  const totalActiveTime = duration + landingPauseMs;

  setTimeout(() => {
    // Only reset to idle if the pet is still performing this specific action.
    // If the pet has transitioned to autonomousRest, rest, playTogether, or
    // approachCursor in the meantime, this stale timeout should be a no-op.
    if (getCurrentAction() === action) {
      dispatchAction("idle");
    }
  }, totalActiveTime);
}

/**
 * Selects an action from the profile's eligible actions based on
 * action weights using weighted random selection.
 *
 * CRITICAL: Return type is AmbientActionName | null — NEVER returns
 * rest, sleep, or approachCursor. This function operates exclusively
 * on AmbientActionName values and never references ActionName.
 *
 * Returns null if:
 * - eligibleActions is empty
 * - All action weights sum to 0 or are invalid
 */
export function selectAction(profile: MovementProfile): AmbientActionName | null {
  const { eligibleActions, actionWeights } = profile;

  // Edge case: no eligible actions
  if (!eligibleActions || eligibleActions.length === 0) {
    return null;
  }

  // Build weighted list from eligible actions only
  const weights: { action: AmbientActionName; weight: number }[] = [];
  let totalWeight = 0;

  for (const action of eligibleActions) {
    const raw = actionWeights[action];
    // Skip NaN, Infinity, negative, zero, or missing entries
    if (typeof raw !== "number" || !isFinite(raw) || raw <= 0) {
      continue;
    }
    weights.push({ action, weight: raw });
    totalWeight += raw;
  }

  // Edge case: all weights sum to 0
  if (totalWeight === 0) {
    return null;
  }

  // Weighted random selection
  const roll = Math.random() * totalWeight;
  let cumulative = 0;

  for (const { action, weight } of weights) {
    cumulative += weight;
    if (roll < cumulative) {
      return action;
    }
  }

  // Fallback (shouldn't reach here due to floating point, but safety)
  return weights[weights.length - 1].action;
}
