/**
 * Cursor Attraction Controller
 *
 * Detects when the user's cursor lingers near idle pets and triggers
 * the `approachCursor` controlled action. Handles proximity detection,
 * eligibility evaluation, cooldown management, multi-pet limiting,
 * and target slot assignment.
 */

import type { PetOverlayState } from "../OverlayApp";
import type { AmbientActionName, MovementProfile } from "./movementProfiles";

// ─── Configuration Constants (exported) ───

/** Pixel radius around the cursor within which eligible pets can be attracted */
export const MOUSE_ATTRACT_RADIUS = 400;

/** How long the cursor must remain within radius before attraction triggers (ms) */
export const MOUSE_ATTRACT_DELAY_MS = 2500;

/** Minimum time between successive attraction activations for a single pet (ms) */
export const MOUSE_ATTRACT_COOLDOWN_MS = 360000;

/** Maximum number of pets that can be attracted simultaneously */
export const MOUSE_ATTRACT_MAX_PETS = 3;

/** Pixel spacing between target slots assigned to simultaneously attracted pets */
export const MOUSE_ATTRACT_TARGET_SPACING = 60;

/** Speed multiplier for approach steps — duration is divided by this value */
export const MOUSE_ATTRACT_SPEED_MULTIPLIER = 2.0;

/** Pause reduction multiplier — landingPauseMs is divided by this value during approach */
export const MOUSE_ATTRACT_PAUSE_MULTIPLIER = 4.0;

// ─── Internal Constants (not exported) ───

/** Controller tick interval for proximity checks (ms) */
const TICK_INTERVAL_MS = 200;

/** Distance threshold to consider a pet as having arrived at its target (px) */
const ARRIVAL_THRESHOLD_PX = 5;

// ─── Interfaces ───

/** Runtime state of the cursor attraction controller */
export interface CursorAttractionState {
  /** Per-pet proximity timer accumulator (ms elapsed within radius) */
  proximityTimers: Map<string, number>;
  /** Per-pet cooldown expiry timestamps */
  cooldownExpiry: Map<string, number>;
  /** Currently active approach pet IDs (those with currentAction === "approachCursor") */
  activePetIds: Set<string>;
  /** Assigned target slots: petId → {x, y} */
  assignedSlots: Map<string, { x: number; y: number }>;
  /** Deferred triggered pets waiting for a slot (ordered by distance) */
  deferredPetIds: string[];
  /** Interval timer ID */
  tickTimer: ReturnType<typeof setInterval> | null;
}

/** A computed target position near the cursor for a specific pet */
export interface TargetSlot {
  /** Horizontal offset from cursor center */
  xOffset: number;
  /** Vertical offset (Phase 1: always 0) */
  yOffset: number;
}

// ─── Pure Helper Functions (exported for testing) ───

/**
 * Computes Euclidean distance between the cursor position and the center of the pet sprite.
 * Pet center is calculated as (petX + petSize/2, petY + petSize/2).
 */
export function computeDistance(
  cursorX: number,
  cursorY: number,
  petX: number,
  petY: number,
  petSize: number
): number {
  const centerX = petX + petSize / 2;
  const centerY = petY + petSize / 2;
  const dx = cursorX - centerX;
  const dy = cursorY - centerY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Selects the nearest N eligible pets from a candidate list.
 * Sorts by distance ascending; ties broken by lower index.
 * Returns the first `maxCount` pet IDs from the sorted result.
 */
export function selectNearestPets(
  candidates: Array<{ petId: string; distance: number; index: number }>,
  maxCount: number
): string[] {
  const sorted = [...candidates].sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.index - b.index;
  });
  return sorted.slice(0, maxCount).map((c) => c.petId);
}

/**
 * Evaluates whether a pet is eligible for cursor attraction.
 * Returns true if and only if ALL conditions hold:
 * - pet.lifecycleState !== "evolving"
 * - pet.physicsState === "idle"
 * - pet.currentAction === "idle"
 * - cooldownExpiry is undefined OR now >= cooldownExpiry
 */
export function isEligible(
  pet: PetOverlayState,
  cooldownExpiry: number | undefined,
  now: number
): boolean {
  if (pet.lifecycleState === "evolving") return false;
  if (pet.physicsState !== "idle") return false;
  if (pet.currentAction !== "idle") return false;
  if (cooldownExpiry !== undefined && now < cooldownExpiry) return false;
  return true;
}

/**
 * Computes target slot X positions for N pets centered around cursorX.
 * Slots are arranged in an alternating offset pattern: [0, -spacing, +spacing, -2*spacing, +2*spacing, ...]
 * The entire group is shifted as a unit if any slot would exceed viewport bounds.
 * Returns fewer slots if viewport is too narrow to fit all requested slots.
 *
 * @param cursorX - The cursor's X coordinate (center of the slot group)
 * @param petCount - The number of slots requested
 * @param spacing - Pixel spacing between adjacent slots
 * @param viewportWidth - The overlay viewport width in pixels
 * @param petSize - The pet sprite size in pixels
 * @returns Array of X coordinates for each slot (index 0 is center-most)
 */
export function computeTargetSlotXs(
  cursorX: number,
  petCount: number,
  spacing: number,
  viewportWidth: number,
  petSize: number
): number[] {
  if (petCount <= 0 || spacing <= 0 || viewportWidth <= petSize) {
    return [];
  }

  // Determine max slots that fit within the viewport
  const maxFittingCount = Math.floor((viewportWidth - petSize) / spacing) + 1;
  const slotCount = Math.min(petCount, maxFittingCount);

  if (slotCount <= 0) {
    return [];
  }

  // Generate alternating offsets: [0, -spacing, +spacing, -2*spacing, +2*spacing, ...]
  const offsets: number[] = [];
  for (let i = 0; i < slotCount; i++) {
    if (i === 0) {
      offsets.push(0);
    } else if (i % 2 === 1) {
      // Odd indices: negative direction
      const level = Math.ceil(i / 2);
      offsets.push(-level * spacing);
    } else {
      // Even indices (>0): positive direction
      const level = i / 2;
      offsets.push(level * spacing);
    }
  }

  // Convert offsets to positions
  const positions = offsets.map((offset) => cursorX + offset);

  // Check if any position exceeds viewport bounds [0, viewportWidth - petSize]
  const maxX = viewportWidth - petSize;
  const minPos = Math.min(...positions);
  const maxPos = Math.max(...positions);

  let shift = 0;
  if (minPos < 0) {
    shift = -minPos; // shift right to bring min to 0
  } else if (maxPos > maxX) {
    shift = maxX - maxPos; // shift left to bring max to maxX
  }

  // After initial shift, check the other bound
  if (minPos + shift < 0) {
    shift = -minPos;
  } else if (maxPos + shift > maxX) {
    shift = maxX - maxPos;
  }

  // Apply shift
  return positions.map((pos) => pos + shift);
}

/**
 * Computes the slot Y offset for a given slot index.
 * Phase 1: always returns 0. Future phases may vary offset by slot.
 */
export function computeSlotOffsetY(_slotIndex: number): number {
  return 0;
}

export interface CursorAttractionDeps {
  /** Returns current cursor position (overlay-local coords) or null if unavailable */
  getCursorPos: () => { x: number; y: number } | null;
  /** Returns all current pet overlay states */
  getPets: () => PetOverlayState[];
  /** Returns the overlay viewport width */
  getViewportWidth: () => number;
  /** Returns the ground Y value */
  getGroundY: () => number;
  /**
   * Dispatches the approachCursor action for a pet toward a target slot.
   * Implemented by OverlayApp — sets currentAction, starts animation loop.
   */
  dispatchApproach: (petId: string, targetX: number, targetY: number) => void;
  /**
   * Cancels an active approach for a pet.
   * Implemented by OverlayApp — cancels stored animation/loop,
   * sets currentAction to idle, then calls notifyApproachEnded().
   * Does NOT modify physicsState.
   */
  cancelApproach: (petId: string) => void;
}

// ─── Controller Lifecycle ───

/**
 * Creates and starts the cursor attraction controller.
 * Initializes state with empty maps/sets and starts a setInterval tick
 * at TICK_INTERVAL_MS (200ms). On each tick, evaluates all pets for
 * proximity, eligibility, and dispatches approach actions as appropriate.
 *
 * Handles Requirement 1.6: if cursor is already within radius at init,
 * the first tick naturally starts timers from zero.
 */
export function createCursorAttractionController(
  deps: CursorAttractionDeps
): CursorAttractionState {
  const state: CursorAttractionState = {
    proximityTimers: new Map(),
    cooldownExpiry: new Map(),
    activePetIds: new Set(),
    assignedSlots: new Map(),
    deferredPetIds: [],
    tickTimer: null,
  };

  state.tickTimer = setInterval(() => {
    tick(state, deps);
  }, TICK_INTERVAL_MS);

  return state;
}

/**
 * Destroys the controller, clearing the tick timer and all state.
 */
export function destroyCursorAttractionController(
  state: CursorAttractionState
): void {
  if (state.tickTimer !== null) {
    clearInterval(state.tickTimer);
    state.tickTimer = null;
  }
  state.proximityTimers.clear();
  state.cooldownExpiry.clear();
  state.activePetIds.clear();
  state.assignedSlots.clear();
  state.deferredPetIds = [];
}

/**
 * Called by OverlayApp AFTER it has set currentAction to idle.
 * Releases the slot and records cooldown for the pet.
 * If deferred pets are waiting, activates the nearest one.
 */
export function notifyApproachEnded(
  state: CursorAttractionState,
  petId: string,
  deps?: CursorAttractionDeps
): void {
  // Remove from active set and release slot
  state.activePetIds.delete(petId);
  state.assignedSlots.delete(petId);

  // Record cooldown expiry
  state.cooldownExpiry.set(petId, Date.now() + MOUSE_ATTRACT_COOLDOWN_MS);

  // Reset proximity timer so re-attraction requires a fresh linger
  state.proximityTimers.delete(petId);

  // Activate next deferred pet if any and there is room
  if (deps) {
    activateNextDeferred(state, deps);
  }
}

/**
 * Internal: attempt to activate the next deferred pet.
 * Called when a slot opens up (after notifyApproachEnded or similar).
 *
 * Pops deferred pets in order (already ordered by distance at insertion time),
 * verifies each still exists and is still eligible, assigns a target slot,
 * calls dispatchApproach, and adds to activePetIds and assignedSlots.
 *
 * Skips (removes) deferred pets that are no longer present or no longer eligible.
 */
function activateNextDeferred(
  state: CursorAttractionState,
  deps: CursorAttractionDeps
): void {
  const now = Date.now();
  const pets = deps.getPets();
  const cursorPos = deps.getCursorPos();

  // Can't activate without cursor position
  if (cursorPos === null) {
    return;
  }

  while (
    state.deferredPetIds.length > 0 &&
    state.activePetIds.size < MOUSE_ATTRACT_MAX_PETS
  ) {
    // Pop the first deferred petId (nearest, as list is ordered by distance)
    const deferredPetId = state.deferredPetIds.shift()!;

    // Verify the pet still exists
    const pet = pets.find((p) => p.id === deferredPetId);
    if (!pet) {
      continue; // Pet was removed, skip
    }

    // Verify the pet is still eligible
    if (!isEligible(pet, state.cooldownExpiry.get(deferredPetId), now)) {
      continue; // No longer eligible, skip
    }

    // Verify the pet is not already active (shouldn't happen, but be safe)
    if (state.activePetIds.has(deferredPetId)) {
      continue;
    }

    // Assign target slot
    const viewportWidth = deps.getViewportWidth();
    const petSize = 72; // PET_RENDER_SIZE
    const slotCount = state.activePetIds.size + 1;
    const slotXs = computeTargetSlotXs(
      cursorPos.x,
      slotCount,
      MOUSE_ATTRACT_TARGET_SPACING,
      viewportWidth,
      petSize
    );

    // The new pet gets the last slot in the computed array
    const targetX = slotXs[slotXs.length - 1] ?? cursorPos.x;
    const targetY = computeTargetY(pet, deps.getGroundY());

    // Add to active set and record slot assignment
    state.activePetIds.add(deferredPetId);
    state.assignedSlots.set(deferredPetId, { x: targetX, y: targetY });

    // Dispatch the approach
    deps.dispatchApproach(deferredPetId, targetX, targetY);

    // Only activate one per slot release to avoid bulk dispatches
    break;
  }
}

/**
 * Core tick function — called every TICK_INTERVAL_MS.
 * Reads cursor position and pet states, then runs proximity/eligibility/dispatch logic.
 */
function tick(state: CursorAttractionState, deps: CursorAttractionDeps): void {
  const cursorPos = deps.getCursorPos();
  const now = Date.now();

  // If cursor position is unavailable, reset all proximity timers
  if (cursorPos === null) {
    state.proximityTimers.clear();
    return;
  }

  const pets = deps.getPets();
  const petIds = new Set(pets.map((p) => p.id));

  // Clean up timers for pets that no longer exist
  for (const petId of state.proximityTimers.keys()) {
    if (!petIds.has(petId)) {
      state.proximityTimers.delete(petId);
    }
  }

  // Clean up deferred pets that no longer exist or are no longer eligible
  state.deferredPetIds = state.deferredPetIds.filter((deferredId) => {
    // Remove if pet no longer exists
    if (!petIds.has(deferredId)) return false;
    // Remove if pet is no longer eligible
    const pet = pets.find((p) => p.id === deferredId);
    if (!pet) return false;
    return isEligible(pet, state.cooldownExpiry.get(deferredId), now);
  });

  // Check active pets for cursor exit radius (Requirement 8.5)
  // If cursor has moved beyond radius of an actively approaching pet, cancel it
  const petSize = 72; // PET_RENDER_SIZE — standard pet render size
  for (const activePetId of state.activePetIds) {
    const pet = pets.find((p) => p.id === activePetId);
    if (!pet) continue;

    const distance = computeDistance(
      cursorPos.x,
      cursorPos.y,
      pet.x,
      pet.y,
      petSize
    );

    if (distance > MOUSE_ATTRACT_RADIUS) {
      // Cursor has exited the radius for this active pet — cancel approach
      deps.cancelApproach(activePetId);
    }
  }

  // Track which pets triggered this tick (for multi-pet selection)
  const triggered: Array<{ petId: string; distance: number; index: number }> = [];

  for (let i = 0; i < pets.length; i++) {
    const pet = pets[i];
    const petId = pet.id;

    // Skip pets that are already actively approaching
    if (state.activePetIds.has(petId)) {
      continue;
    }

    // Compute distance from cursor to pet center
    const distance = computeDistance(
      cursorPos.x,
      cursorPos.y,
      pet.x,
      pet.y,
      petSize
    );

    const withinRadius = distance <= MOUSE_ATTRACT_RADIUS;
    const eligible = isEligible(pet, state.cooldownExpiry.get(petId), now);

    if (withinRadius && eligible) {
      // Accumulate proximity timer
      const currentTimer = state.proximityTimers.get(petId) ?? 0;
      const newTimer = currentTimer + TICK_INTERVAL_MS;
      state.proximityTimers.set(petId, newTimer);

      // Check if timer has reached the delay threshold
      if (newTimer >= MOUSE_ATTRACT_DELAY_MS) {
        // Re-evaluate eligibility at trigger moment (Requirement 2.7)
        const stillEligible = isEligible(
          pet,
          state.cooldownExpiry.get(petId),
          now
        );

        if (stillEligible) {
          triggered.push({ petId, distance, index: i });
        }

        // Reset timer regardless — either triggered or failed re-eval
        state.proximityTimers.delete(petId);
      }
    } else {
      // Outside radius or ineligible — reset timer (Requirements 1.4, 2.5)
      if (state.proximityTimers.has(petId)) {
        state.proximityTimers.delete(petId);
      }
    }
  }

  // Process triggered pets: multi-pet limiting
  if (triggered.length > 0) {
    // Select nearest pets up to available capacity
    const availableSlots = MOUSE_ATTRACT_MAX_PETS - state.activePetIds.size;

    if (availableSlots > 0) {
      const selected = selectNearestPets(triggered, availableSlots);

      for (const petId of selected) {
        const pet = pets.find((p) => p.id === petId);
        if (!pet) continue;

        // Assign target slot
        const slotCount = state.activePetIds.size + 1;
        const viewportWidth = deps.getViewportWidth();
        const slotXs = computeTargetSlotXs(
          cursorPos.x,
          slotCount,
          MOUSE_ATTRACT_TARGET_SPACING,
          viewportWidth,
          petSize
        );

        // The new pet gets the last slot in the computed array
        const targetX = slotXs[slotXs.length - 1] ?? cursorPos.x;
        const targetY = computeTargetY(pet, deps.getGroundY());

        state.activePetIds.add(petId);
        state.assignedSlots.set(petId, { x: targetX, y: targetY });

        deps.dispatchApproach(petId, targetX, targetY);
      }

      // Defer any remaining triggered pets that didn't get a slot
      const selectedSet = new Set(selected);
      for (const t of triggered) {
        if (!selectedSet.has(t.petId) && !state.deferredPetIds.includes(t.petId)) {
          state.deferredPetIds.push(t.petId);
        }
      }
    } else {
      // No available slots — defer all triggered pets
      for (const t of triggered) {
        if (!state.deferredPetIds.includes(t.petId)) {
          state.deferredPetIds.push(t.petId);
        }
      }
    }
  }
}

/**
 * Computes the target Y coordinate for a pet's approach.
 * Floating pets: groundY - hoverOffsetY + slotOffsetY
 * Grounded pets: groundY - petSize (resolved rest Y)
 */
function computeTargetY(pet: PetOverlayState, groundY: number): number {
  const profile = pet.resolvedProfile;

  if (profile.movementStyle === "floating") {
    const hoverOffsetY = profile.hoverOffsetY ?? 0;
    return groundY - hoverOffsetY + computeSlotOffsetY(0);
  }

  // Grounded pets: their current Y (resolved rest Y) is appropriate
  return pet.y;
}

// ─── Approach Action Resolution ───

/** Priority list for grounded profiles: first match in eligibleActions wins */
const GROUNDED_PRIORITY: AmbientActionName[] = [
  "squishHop", "smallLeap", "leap", "tinyHop", "hop"
];

/** Priority list for floating profiles: first match in eligibleActions wins */
const FLOATING_PRIORITY: AmbientActionName[] = ["drift", "bob"];

/**
 * Resolves which AmbientActionName to use for approach animation steps
 * based on the pet's resolved MovementProfile.
 *
 * Does NOT hardcode species/lifeStage — uses profile.eligibleActions only.
 *
 * Priority:
 *   floating: drift → bob
 *   grounded: squishHop → smallLeap → leap → tinyHop → hop
 *   fallback: hop
 */
export function resolveApproachAmbientAction(
  profile: MovementProfile
): AmbientActionName {
  const eligible = new Set(profile.eligibleActions);

  if (profile.movementStyle === "floating") {
    for (const action of FLOATING_PRIORITY) {
      if (eligible.has(action)) return action;
    }
  } else {
    for (const action of GROUNDED_PRIORITY) {
      if (eligible.has(action)) return action;
    }
  }

  // Fallback for any profile
  return "hop";
}


