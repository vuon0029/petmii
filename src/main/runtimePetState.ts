// Runtime busy state. NEVER persisted to disk. Cleared on app restart.

/**
 * Manages transient runtime state for pets.
 * Owns all busy-state tracking that ipcHandlers.ts previously held inline.
 */

/** Tracks pets in autonomous actions (autonomousRest, playTogether) */
export const autonomousActionPetIds = new Map<string, { action: string; endTime: number }>();

/** Tracks pets resting in overlay */
export const restingPetIds = new Set<string>();

/** Tracks pets currently evolving */
export const evolvingPetIds = new Set<string>();

/**
 * Tracks pets with a user action currently being processed (Feed/Play/Rest/Clean).
 *
 * - Set only while a user action is being processed in the `pet:action` IPC handler.
 * - MUST be cleared in a try/finally block in the `pet:action` handler so it is
 *   always removed on both success and failure paths.
 * - It is safe to call `clearUserActionInProgress` even if the petId is not in
 *   the set (Set.delete is a no-op for missing elements).
 * - Runtime state is NEVER persisted to disk. Cleared automatically on app restart.
 *
 * NOTE: Currently, the flag is cleared immediately after the synchronous action
 * application in the main process. If the renderer later controls action animation
 * completion, a `pet:user-action-complete` IPC event could be added to clear this
 * flag from the renderer side instead.
 */
export const userActionInProgress = new Set<string>();

/**
 * Returns true if the pet is busy (cannot receive user actions).
 * Combines all runtime busy sources.
 */
export function isPetBusy(petId: string): boolean {
  if (autonomousActionPetIds.has(petId)) return true;
  if (restingPetIds.has(petId)) return true;
  if (evolvingPetIds.has(petId)) return true;
  if (userActionInProgress.has(petId)) return true;
  return false;
}

// --- Autonomous action tracking ---

/**
 * Mark a pet as performing an autonomous action.
 */
export function setAutonomousAction(petId: string, action: string, endTime: number): void {
  autonomousActionPetIds.set(petId, { action, endTime });
}

/**
 * Clear the autonomous action flag for a pet.
 */
export function clearAutonomousAction(petId: string): void {
  autonomousActionPetIds.delete(petId);
}

/**
 * Get info about a pet's current autonomous action, or null if none.
 */
export function getAutonomousActionInfo(petId: string): { action: string; endTime: number } | null {
  return autonomousActionPetIds.get(petId) ?? null;
}

// --- Resting tracking ---

/**
 * Mark a pet as resting in the overlay.
 */
export function setResting(petId: string): void {
  restingPetIds.add(petId);
}

/**
 * Clear the resting flag for a pet.
 */
export function clearResting(petId: string): void {
  restingPetIds.delete(petId);
}

// --- Evolving tracking ---

/**
 * Mark a pet as currently evolving.
 */
export function setEvolving(petId: string): void {
  evolvingPetIds.add(petId);
}

/**
 * Clear the evolving flag for a pet.
 */
export function clearEvolving(petId: string): void {
  evolvingPetIds.delete(petId);
}

// --- User action in progress tracking ---

// Usage in IPC handler:
// try {
//   setUserActionInProgress(petId);
//   ... validate and apply ...
// } finally {
//   clearUserActionInProgress(petId);
// }

/**
 * Mark a pet as having a user action in progress.
 * Callers MUST use try/finally to guarantee cleanup via clearUserActionInProgress.
 * Must be cleared via clearUserActionInProgress on completion/failure.
 */
export function setUserActionInProgress(petId: string): void {
  userActionInProgress.add(petId);
}

/**
 * Clear the user-action-in-progress flag.
 * Called on action completion or failure.
 * Safe to call even if petId is not in the set.
 */
export function clearUserActionInProgress(petId: string): void {
  userActionInProgress.delete(petId);
}
