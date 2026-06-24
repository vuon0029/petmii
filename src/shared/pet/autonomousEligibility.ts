/**
 * Blocking actions that prevent autonomous actions from starting.
 * Uses a blocklist approach: anything NOT in this list is considered
 * non-blocking (interruptible idle behavior).
 */
export const BLOCKING_ACTIONS: readonly string[] = [
  'rest',
  'sleep',
  'manualRest',
  'autonomousRest',
  'playTogether',
  'feed',
  'play',
  'clean',
  'approachCursor',
  'evolving',
];

/**
 * Determines if a pet's runtime state allows autonomous actions to start.
 * Uses a blocking-action approach: eligible unless explicitly blocked.
 *
 * Returns true when:
 * - physicsState === "idle" (excludes dragging, flying, landed, gettingUp)
 * - lifecycleState !== "evolving"
 * - currentAction is NOT in BLOCKING_ACTIONS
 *
 * Interruptible idle behaviors (idle animation, light bobbing, passive wandering,
 * ambient idle movement) are NOT in BLOCKING_ACTIONS and thus do not block.
 */
export function isAutonomousEligibleRuntimeState(state: {
  physicsState: string;
  currentAction: string;
  lifecycleState: string;
}): boolean {
  if (state.physicsState !== 'idle') return false;

  if (state.lifecycleState === 'evolving') return false;

  if (BLOCKING_ACTIONS.includes(state.currentAction)) return false;

  return true;
}
