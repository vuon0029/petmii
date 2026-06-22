/**
 * Autonomous Action Controller
 *
 * Enables pets to self-direct two meaningful activities — autonomousRest
 * and playTogether — independent of the existing action scheduler's ambient
 * movement system. Follows the same architectural pattern as
 * cursorAttractionController.ts: state interface, dependency injection,
 * create/destroy lifecycle, and periodic tick evaluation.
 */

import type { PetOverlayState } from "../OverlayApp";
import { TEST_MODE, TEST_AUTONOMOUS_REST_BASE_CHANCE, TEST_AUTONOMOUS_REST_COOLDOWN_MS, TEST_PLAY_TOGETHER_BASE_CHANCE, TEST_PLAY_TOGETHER_COOLDOWN_MS } from "../../shared/testMode";

// ─── Tunable Constants (exported) ───

/** Tick interval for the autonomous action evaluation loop (ms) 5000 */
export const AUTONOMOUS_TICK_INTERVAL_MS = 5000;

/** Base probability (0–1) that an eligible pet begins autonomousRest per tick */
export const AUTONOMOUS_REST_BASE_CHANCE = TEST_MODE ? TEST_AUTONOMOUS_REST_BASE_CHANCE : 0.04;

/** Multiplier applied to rest base chance during the nighttime window */
export const AUTONOMOUS_REST_NIGHT_MULTIPLIER = 3.0;

/** Hour (0–23) at which the nighttime window begins (inclusive) */
export const NIGHTTIME_START_HOUR = 22;

/** Hour (0–23) at which the nighttime window ends (exclusive) */
export const NIGHTTIME_END_HOUR = 6;

/** Cooldown duration (ms) after autonomousRest ends before it can trigger again */
export const AUTONOMOUS_REST_COOLDOWN_MS = TEST_MODE ? TEST_AUTONOMOUS_REST_COOLDOWN_MS : 300000;

/** Base probability (0–1) that playTogether triggers per eligible tick */
export const PLAY_TOGETHER_BASE_CHANCE = TEST_MODE ? TEST_PLAY_TOGETHER_BASE_CHANCE : 0.1;

/** Minimum number of pets required for playTogether eligibility */
export const PLAY_TOGETHER_MIN_PETS = 2;

/** Minimum duration (ms) for a playTogether session */
export const PLAY_TOGETHER_MIN_DURATION_MS = 30000;

/** Maximum duration (ms) for a playTogether session */
export const PLAY_TOGETHER_MAX_DURATION_MS = 60000;

/** Cooldown duration (ms) after playTogether ends before it can trigger again */
export const PLAY_TOGETHER_COOLDOWN_MS = TEST_MODE ? TEST_PLAY_TOGETHER_COOLDOWN_MS : 120000;

/** Maximum X distance between two pets for playTogether eligibility (px) */
export const PLAY_TOGETHER_TRIGGER_RADIUS_PX = 150;

/** Minimum spacing between pets during playTogether (px) */
export const PLAY_TOGETHER_MIN_SPACING_PX = 30;

/** Maximum spacing between pets during playTogether (px) */
export const PLAY_TOGETHER_MAX_SPACING_PX = 60;

/** Pool of playful icons used during playTogether sessions */
export const PLAY_TOGETHER_ICONS = ["💫", "⚽", "🎾", "🧶", "🪀", "🧸", "🪁", "✨"];

/** Selects a random icon from the playTogether icon pool */
export function selectPlayIcon(): string {
  return PLAY_TOGETHER_ICONS[Math.floor(Math.random() * PLAY_TOGETHER_ICONS.length)];
}

// ─── Interfaces ───

/** Active playTogether session tracking */
export interface PlayTogetherSession {
  petId1: string;
  petId2: string;
  durationTimer: ReturnType<typeof setTimeout>;
}

/** Runtime state of the autonomous action controller */
export interface AutonomousActionState {
  /** Interval timer ID for the tick loop */
  tickTimer: ReturnType<typeof setInterval> | null;

  /** Per-pet autonomousRest cooldown expiry timestamps */
  restCooldownExpiry: Map<string, number>;

  /** Per-pet playTogether cooldown expiry timestamps */
  playCooldownExpiry: Map<string, number>;

  /** Pet IDs currently in autonomousRest → their duration timer */
  activeRest: Map<string, ReturnType<typeof setTimeout>>;

  /** Active playTogether session (at most one at a time in V1) */
  activePlaySession: PlayTogetherSession | null;
}

/** Dependency injection interface for the autonomous action controller */
export interface AutonomousActionDeps {
  getPets: () => PetOverlayState[];
  getViewportWidth: () => number;
  getGroundY: () => number;
  dispatchAutonomousRest: (petId: string) => void;
  endAutonomousRest: (petId: string) => void;
  dispatchPlayTogether: (petId1: string, petId2: string, durationMs: number) => void;
  endPlayTogether: (petId1: string, petId2: string) => void;
  getCurrentHour: () => number;
}

// ─── Pure Helper Functions (exported for testing) ───

/** Returns true if the given hour is within the nighttime window */
export function isNighttime(hour: number): boolean {
  // Window wraps midnight: NIGHTTIME_START_HOUR (22) through NIGHTTIME_END_HOUR (6, exclusive)
  // Nighttime hours: 22, 23, 0, 1, 2, 3, 4, 5
  return hour >= NIGHTTIME_START_HOUR || hour < NIGHTTIME_END_HOUR;
}

/** Computes effective autonomousRest probability for the given hour */
export function computeRestProbability(hour: number): number {
  if (isNighttime(hour)) {
    return AUTONOMOUS_REST_BASE_CHANCE * AUTONOMOUS_REST_NIGHT_MULTIPLIER;
  }
  return AUTONOMOUS_REST_BASE_CHANCE;
}

/** Evaluates whether a pet is eligible for autonomousRest */
export function isEligibleForRest(
  pet: PetOverlayState,
  cooldownExpiry: number | undefined,
  now: number
): boolean {
  if (pet.physicsState !== "idle") return false;
  if (pet.currentAction !== "idle") return false;
  if (pet.lifecycleState === "evolving") return false;
  if (cooldownExpiry !== undefined && now < cooldownExpiry) return false;
  return true;
}

/** Evaluates whether a pet is eligible for playTogether */
export function isEligibleForPlay(
  pet: PetOverlayState,
  cooldownExpiry: number | undefined,
  now: number
): boolean {
  if (pet.physicsState !== "idle") return false;
  if (pet.currentAction !== "idle") return false;
  if (pet.lifecycleState === "evolving") return false;
  if (cooldownExpiry !== undefined && now < cooldownExpiry) return false;
  return true;
}

/** Computes facing directions for two pets based on their X positions */
export function computeFacingDirections(
  x1: number,
  x2: number
): { dir1: 1 | -1; dir2: 1 | -1 } {
  if (x1 < x2) {
    return { dir1: 1, dir2: -1 };
  } else if (x1 > x2) {
    return { dir1: -1, dir2: 1 };
  }
  // Equal positions: first faces right, second faces left
  return { dir1: 1, dir2: -1 };
}

/** Computes the midpoint position for the sparkle effect */
export function computeEffectPosition(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  petSize: number
): { x: number; y: number } {
  const halfSize = petSize / 2;
  return {
    x: (x1 + halfSize + x2 + halfSize) / 2,
    y: (y1 + halfSize + y2 + halfSize) / 2,
  };
}

/** Selects exactly 2 pets at random from an eligible array */
export function selectPairForPlay(
  eligiblePetIds: string[]
): [string, string] {
  // Fisher-Yates-style selection of 2 distinct elements
  const firstIndex = Math.floor(Math.random() * eligiblePetIds.length);
  const first = eligiblePetIds[firstIndex];

  // Build remaining pool excluding the first pick
  const remaining = eligiblePetIds.filter((_, i) => i !== firstIndex);
  const secondIndex = Math.floor(Math.random() * remaining.length);
  const second = remaining[secondIndex];

  return [first, second];
}

/** Generates a random duration between min and max constants */
export function generatePlayDuration(): number {
  return Math.floor(
    Math.random() * (PLAY_TOGETHER_MAX_DURATION_MS - PLAY_TOGETHER_MIN_DURATION_MS) +
      PLAY_TOGETHER_MIN_DURATION_MS
  );
}

/** Selects a random eligible pair of pets within the trigger radius. Returns null if no pair found. */
export function selectProximityPair(
  eligiblePetIds: string[],
  pets: PetOverlayState[]
): [string, string] | null {
  // Find all pairs within PLAY_TOGETHER_TRIGGER_RADIUS_PX
  const pairs: [string, string][] = [];
  for (let i = 0; i < eligiblePetIds.length; i++) {
    for (let j = i + 1; j < eligiblePetIds.length; j++) {
      const pet1 = pets.find(p => p.id === eligiblePetIds[i]);
      const pet2 = pets.find(p => p.id === eligiblePetIds[j]);
      if (pet1 && pet2 && Math.abs(pet1.x - pet2.x) <= PLAY_TOGETHER_TRIGGER_RADIUS_PX) {
        pairs.push([eligiblePetIds[i], eligiblePetIds[j]]);
      }
    }
  }
  if (pairs.length === 0) return null;
  // Pick a random pair
  return pairs[Math.floor(Math.random() * pairs.length)];
}

/** Generates a random spacing between min and max */
export function generatePlaySpacing(): number {
  return Math.floor(
    Math.random() * (PLAY_TOGETHER_MAX_SPACING_PX - PLAY_TOGETHER_MIN_SPACING_PX) +
      PLAY_TOGETHER_MIN_SPACING_PX
  );
}

// ─── Internal Constants ───

/** Duration (ms) for autonomousRest — mirrors REST_ACTION_DURATION_MS from OverlayApp */
const AUTONOMOUS_REST_DURATION_MS = 30000;

// ─── Lifecycle Functions ───

/** Creates and starts the autonomous action controller */
export function createAutonomousActionController(
  deps: AutonomousActionDeps
): AutonomousActionState {
  const state: AutonomousActionState = {
    tickTimer: null,
    restCooldownExpiry: new Map(),
    playCooldownExpiry: new Map(),
    activeRest: new Map(),
    activePlaySession: null,
  };

  state.tickTimer = setInterval(() => {
    tick(state, deps);
  }, AUTONOMOUS_TICK_INTERVAL_MS);

  return state;
}

/** Destroys the autonomous action controller, clearing all timers and state */
export function destroyAutonomousActionController(
  state: AutonomousActionState
): void {
  if (state.tickTimer !== null) {
    clearInterval(state.tickTimer);
    state.tickTimer = null;
  }

  // Clear all duration timers in activeRest
  for (const timer of state.activeRest.values()) {
    clearTimeout(timer);
  }

  // Clear activePlaySession duration timer if present
  if (state.activePlaySession !== null) {
    clearTimeout(state.activePlaySession.durationTimer);
    state.activePlaySession = null;
  }

  state.restCooldownExpiry.clear();
  state.playCooldownExpiry.clear();
  state.activeRest.clear();
}

// ─── Notification Callbacks ───

/** Called when autonomousRest ends (duration or interruption). Records cooldown. */
export function notifyAutonomousRestEnded(
  state: AutonomousActionState,
  petId: string
): void {
  // Remove from activeRest (timer already fired or was cleared by caller)
  state.activeRest.delete(petId);
  // Record cooldown expiry
  state.restCooldownExpiry.set(petId, Date.now() + AUTONOMOUS_REST_COOLDOWN_MS);
}

/** Called when playTogether ends (duration or interruption). Records cooldown for both. */
export function notifyPlayTogetherEnded(
  state: AutonomousActionState,
  petId1: string,
  petId2: string
): void {
  state.activePlaySession = null;
  const now = Date.now();
  state.playCooldownExpiry.set(petId1, now + PLAY_TOGETHER_COOLDOWN_MS);
  state.playCooldownExpiry.set(petId2, now + PLAY_TOGETHER_COOLDOWN_MS);
}

// ─── Internal Tick Logic ───

/** Core tick function — evaluates pets for autonomous actions each interval */
function tick(state: AutonomousActionState, deps: AutonomousActionDeps): void {
  const pets = deps.getPets();
  if (pets.length === 0) return;

  const now = Date.now();
  const hour = deps.getCurrentHour();
  const effectiveRestProbability = computeRestProbability(hour);

  // Clean up stale entries from activeRest for pets that no longer exist
  const petIds = new Set(pets.map((p) => p.id));
  for (const petId of state.activeRest.keys()) {
    if (!petIds.has(petId)) {
      clearTimeout(state.activeRest.get(petId)!);
      state.activeRest.delete(petId);
    }
  }

  // ─── autonomousRest evaluation ───
  for (const pet of pets) {
    if (state.activeRest.has(pet.id)) continue; // Already resting autonomously

    if (isEligibleForRest(pet, state.restCooldownExpiry.get(pet.id), now)) {
      if (Math.random() < effectiveRestProbability) {
        deps.dispatchAutonomousRest(pet.id);

        // Create duration timer — when it fires, call endAutonomousRest
        const timer = setTimeout(() => {
          deps.endAutonomousRest(pet.id);
        }, AUTONOMOUS_REST_DURATION_MS);

        state.activeRest.set(pet.id, timer);
      }
    }
  }

  // ─── playTogether evaluation ───
  if (state.activePlaySession === null) {
    const eligible: string[] = [];
    for (const pet of pets) {
      if (isEligibleForPlay(pet, state.playCooldownExpiry.get(pet.id), now)) {
        eligible.push(pet.id);
      }
    }

    if (eligible.length >= PLAY_TOGETHER_MIN_PETS) {
      if (Math.random() < PLAY_TOGETHER_BASE_CHANCE) {
        const pair = selectProximityPair(eligible, pets);
        if (!pair) return; // No pair within radius
        const [petId1, petId2] = pair;
        const duration = generatePlayDuration();

        deps.dispatchPlayTogether(petId1, petId2, duration);

        // Create duration timer — when it fires, call endPlayTogether
        const durationTimer = setTimeout(() => {
          deps.endPlayTogether(petId1, petId2);
        }, duration);

        state.activePlaySession = { petId1, petId2, durationTimer };
      }
    }
  }
}
