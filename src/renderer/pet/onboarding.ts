/**
 * Onboarding state machine for petmii.
 *
 * Defines the valid application onboarding states and enforces
 * transition rules so the app always knows which screen to display.
 */

export type AppOnboardingState =
  | "NO_PET"
  | "EGG_READY"
  | "HATCHING"
  | "NAMING"
  | "ACTIVE_PET";

/**
 * Map of valid transitions from each state.
 * Only the transitions listed here are permitted.
 */
export const VALID_TRANSITIONS: Record<AppOnboardingState, AppOnboardingState[]> = {
  NO_PET: ["EGG_READY"],
  EGG_READY: ["HATCHING"],
  HATCHING: ["ACTIVE_PET"],
  NAMING: ["ACTIVE_PET"],
  ACTIVE_PET: ["EGG_READY"],
};

/**
 * Checks whether a transition from one state to another is valid.
 *
 * @param from - The current onboarding state
 * @param to - The target onboarding state
 * @returns true if the transition is permitted, false otherwise
 */
export function isValidTransition(
  from: AppOnboardingState,
  to: AppOnboardingState
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Attempts to transition from the current state to a target state.
 * Returns the target state if the transition is valid, otherwise
 * returns the current state unchanged.
 *
 * @param current - The current onboarding state
 * @param target - The desired target state
 * @returns The resulting state after the transition attempt
 */
export function transitionState(
  current: AppOnboardingState,
  target: AppOnboardingState
): AppOnboardingState {
  if (isValidTransition(current, target)) {
    return target;
  }
  return current;
}
