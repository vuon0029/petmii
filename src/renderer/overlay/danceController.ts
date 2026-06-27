// src/renderer/overlay/danceController.ts
// Renderer-side controller for dance behavior.
// Follows the same create/destroy lifecycle with dependency injection
// as autonomousActionController.ts and cursorAttractionController.ts.

import type { MediaClassification } from "../../shared/media/mediaTypes";
import { classifyMedia } from "../../shared/media/mediaClassifier";
import { DANCE_CONFIDENCE_THRESHOLD, isBrowserOrigin } from "../../shared/media/mediaClassifier";
import { isPetEligibleForDance } from "../../shared/pet/danceEligibility";
import type { MediaPlaybackState } from "../../shared/media/mediaTypes";

// ─── Tunable Constants (exported) ───

export const DANCE_EVALUATION_INTERVAL_MS = 10_000;
export const DANCE_TRIGGER_CHANCE = 0.25;
export const DANCE_DURATION_MS = 8_000;
export const DANCE_COOLDOWN_MS = 45_000;
export const DANCE_CANCEL_COOLDOWN_MS = 10_000;
export const DANCE_MAX_SIMULTANEOUS_STARTS = 2;

// ─── Interfaces ───

export interface DanceControllerState {
  tickTimer: ReturnType<typeof setInterval> | null;
  /** Per-pet cooldown expiry (covers both normal and cancel cooldowns) */
  cooldownExpiry: Map<string, number>;
  /** Per-pet active dance duration timer */
  activeDanceTimers: Map<string, ReturnType<typeof setTimeout>>;
  /** Latest media classification received from IPC */
  latestClassification: MediaClassification | null;
}

export interface DancePetInfo {
  id: string;
  physicsState: string;
  currentAction: string;
  lifecycleState: string;
  isAlive: boolean;
  visualState: string;
  stats: {
    hunger: number;
    happiness: number;
    energy: number;
    cleanliness: number;
  };
}

export interface DanceControllerDeps {
  getPets: () => DancePetInfo[];
  getSettings: () => DanceFeatureSettings;
  /** Returns true if the pet currently has an active movement animation in progress */
  hasPendingMovement: (petId: string) => boolean;
  dispatchDance: (petId: string, durationMs: number) => void;
  endDance: (petId: string, completed: boolean) => void;
}

export interface DanceFeatureSettings {
  danceToMusicEnabled: boolean;
  danceToBrowserAudioEnabled: boolean;
  simulateMusicPlaying: boolean;
}

// ─── Pure Helper Functions (exported for testing) ───

/**
 * Determines if a MediaClassification qualifies as a dance trigger.
 *
 * Logic:
 * 1. If danceToMusicEnabled is false → false (hard gate)
 * 2. If simulateMusicPlaying is true AND danceToMusicEnabled is true → true
 *    (works even when classification is null, bypasses browser-source filtering)
 * 3. If classification is null → false
 * 4. If danceToBrowserAudioEnabled is false AND source is browser-origin → false
 * 5. Otherwise require kind === "music" AND confidence >= DANCE_CONFIDENCE_THRESHOLD
 */
export function isDanceTriggerMet(
  classification: MediaClassification | null,
  settings: DanceFeatureSettings,
): boolean {
  if (!settings.danceToMusicEnabled) return false;
  if (settings.simulateMusicPlaying) return true;
  if (classification === null) return false;
  if (!settings.danceToBrowserAudioEnabled && isBrowserOrigin(classification.sourceApp)) {
    return false;
  }
  return classification.kind === "music" && classification.confidence >= DANCE_CONFIDENCE_THRESHOLD;
}

/** Selects up to N eligible pets to start dancing (random subset) */
export function selectDanceCandidates(
  eligiblePetIds: string[],
  maxStarts: number,
): string[] {
  if (eligiblePetIds.length <= maxStarts) return [...eligiblePetIds];

  // Fisher-Yates shuffle, take first maxStarts
  const shuffled = [...eligiblePetIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, maxStarts);
}

// ─── Lifecycle ───

export function createDanceController(
  deps: DanceControllerDeps,
): DanceControllerState {
  const state: DanceControllerState = {
    tickTimer: null,
    cooldownExpiry: new Map(),
    activeDanceTimers: new Map(),
    latestClassification: null,
  };

  state.tickTimer = setInterval(() => {
    tick(state, deps);
  }, DANCE_EVALUATION_INTERVAL_MS);

  return state;
}

export function destroyDanceController(state: DanceControllerState): void {
  if (state.tickTimer !== null) {
    clearInterval(state.tickTimer);
    state.tickTimer = null;
  }

  for (const timer of state.activeDanceTimers.values()) {
    clearTimeout(timer);
  }
  state.activeDanceTimers.clear();
  state.cooldownExpiry.clear();
}

/** Called when IPC delivers new MediaPlaybackState from main */
export function onMediaStateUpdate(
  state: DanceControllerState,
  playbackState: MediaPlaybackState,
): void {
  state.latestClassification = classifyMedia(playbackState);
}

/**
 * Called externally when a dance must be cancelled (drag, priority action).
 *
 * Cancellation semantics:
 * - Clears dance timer, notes, and transforms for the pet
 * - Does NOT force currentAction to "idle" if replacementAction is provided
 * - The higher-priority action owns the next currentAction
 * - Only resets to "idle" when cancelled without a replacement action
 */
export function cancelDance(
  state: DanceControllerState,
  petId: string,
  deps: DanceControllerDeps,
  replacementAction?: string,
): void {
  const timer = state.activeDanceTimers.get(petId);
  if (timer === undefined) return; // Idempotent — no-op if no active dance

  clearTimeout(timer);
  state.activeDanceTimers.delete(petId);

  // Record cancel cooldown
  state.cooldownExpiry.set(petId, Date.now() + DANCE_CANCEL_COOLDOWN_MS);

  // End dance — completed: false means it was cancelled
  // If replacementAction is provided, the caller will set currentAction themselves
  deps.endDance(petId, false);
}

/**
 * Stuck-state recovery: if pet has action "dance" but no timer, recover.
 */
export function recoverStuckDance(
  state: DanceControllerState,
  petId: string,
  pet: { currentAction: string; physicsState: string; lifecycleState: string },
  deps: DanceControllerDeps,
): void {
  // Only recover if action is "dance" but no timer exists
  if (pet.currentAction !== "dance") return;
  if (state.activeDanceTimers.has(petId)) return;

  // Check if a higher-priority state has taken ownership
  const hasHigherPriority =
    pet.physicsState !== "idle" ||
    pet.lifecycleState === "evolving";

  if (hasHigherPriority) {
    // Only clear dance artifacts (notes/transforms/timers), don't override currentAction
    // The caller (OverlayApp) handles visual cleanup based on endDance
    deps.endDance(petId, false);
  } else {
    // No higher-priority state — reset to idle
    deps.endDance(petId, false);
  }
}

// ─── Internal Tick Logic ───

function tick(state: DanceControllerState, deps: DanceControllerDeps): void {
  const settings = deps.getSettings();

  // Hard gate: feature disabled
  if (!settings.danceToMusicEnabled) return;

  // Check trigger condition
  if (!isDanceTriggerMet(state.latestClassification, settings)) return;

  const pets = deps.getPets();
  if (pets.length === 0) return;

  const now = Date.now();

  // Run stuck-state recovery for any pets with action "dance" but no timer
  for (const pet of pets) {
    if (pet.currentAction === "dance" && !state.activeDanceTimers.has(pet.id)) {
      recoverStuckDance(state, pet.id, pet, deps);
    }
  }

  // Filter eligible pets
  const eligible: string[] = [];
  for (const pet of pets) {
    if (
      pet.visualState !== "sleep" &&
      isPetEligibleForDance(
        pet,
        pet.stats,
        state.cooldownExpiry.get(pet.id),
        now,
      ) &&
      !deps.hasPendingMovement(pet.id)
    ) {
      eligible.push(pet.id);
    }
  }

  if (eligible.length === 0) {
    console.log("[petmii:dance] Tick: trigger met but no eligible pets. States:", pets.map(p => `${p.id.slice(0,6)}:${p.currentAction}/${p.physicsState}`).join(", "));
    return;
  }

  // Apply trigger chance per eligible pet
  const triggered: string[] = [];
  for (const petId of eligible) {
    if (Math.random() < DANCE_TRIGGER_CHANCE) {
      triggered.push(petId);
    }
  }

  if (triggered.length === 0) return;

  // Select up to max simultaneous starts
  const selected = selectDanceCandidates(triggered, DANCE_MAX_SIMULTANEOUS_STARTS);

  // Dispatch dance for each selected pet
  for (const petId of selected) {
    console.log("[petmii:dance] Starting dance for pet:", petId.slice(0, 8));
    deps.dispatchDance(petId, DANCE_DURATION_MS);

    // Set duration timer — on natural completion, record cooldown
    const timer = setTimeout(() => {
      state.activeDanceTimers.delete(petId);
      state.cooldownExpiry.set(petId, Date.now() + DANCE_COOLDOWN_MS);
      deps.endDance(petId, true);
    }, DANCE_DURATION_MS);

    state.activeDanceTimers.set(petId, timer);
  }
}
