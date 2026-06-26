/**
 * Movement Profile Types and Data
 *
 * Defines the species-and-life-stage-specific movement profile system.
 * Each profile defines complete movement identity including movementStyle,
 * eligible actions, step distances, hop heights, durations, intervals,
 * and action weights.
 */

export type MovementStyle = "grounded" | "floating";

// Ambient actions — valid for scheduler weighted selection
export type AmbientActionName =
  | "idle"
  | "hop"
  | "leap"
  | "bob"
  | "drift"
  | "squish"
  | "bounce"
  | "tinyHop"
  | "smallLeap"
  | "squishHop";

// Controlled/reactive actions — never selected by scheduler
export type ControlledActionName =
  | "rest"
  | "sleep"
  | "approachCursor"
  | "autonomousRest"
  | "playTogether"
  | "dance";

// Full union for currentAction typing
export type ActionName = AmbientActionName | ControlledActionName;

export type ActionCategory = "movement" | "stationary";

export interface ActionDefinition {
  name: ActionName;
  category: ActionCategory;
}

export interface MovementProfile {
  actionType: string;
  movementStyle: MovementStyle;
  eligibleActions: AmbientActionName[];
  stepDistance: number; // px
  hopHeight: number; // px
  duration: number; // ms
  interval: number; // ms
  landingPauseMs: number; // ms, default 0
  hoverOffsetY: number; // px, default 0
  groundOffsetY: number; // px, default 0
  actionWeights: Partial<Record<AmbientActionName, number>>;
}

// Partial profile for override layers
export type PartialMovementProfile = Partial<MovementProfile>;

export interface SpeciesProfiles {
  default: MovementProfile;
  [lifeStage: string]: PartialMovementProfile | MovementProfile;
}

/**
 * Action definitions mapping each action name to its category.
 * Movement actions change position; stationary actions do not.
 */
export const ACTION_DEFINITIONS: Record<ActionName, ActionDefinition> = {
  idle: { name: "idle", category: "stationary" },
  hop: { name: "hop", category: "movement" },
  leap: { name: "leap", category: "movement" },
  bob: { name: "bob", category: "movement" },
  drift: { name: "drift", category: "movement" },
  squish: { name: "squish", category: "stationary" },
  bounce: { name: "bounce", category: "stationary" },
  tinyHop: { name: "tinyHop", category: "movement" },
  smallLeap: { name: "smallLeap", category: "movement" },
  squishHop: { name: "squishHop", category: "movement" },
  rest: { name: "rest", category: "stationary" },
  sleep: { name: "sleep", category: "stationary" },
  approachCursor: { name: "approachCursor", category: "movement" },
  autonomousRest: { name: "autonomousRest", category: "stationary" },
  playTogether: { name: "playTogether", category: "stationary" },
};

/**
 * Global default profile used as the final fallback when no species
 * or life-stage-specific profile matches. Provides blob-like grounded
 * hop defaults.
 */
export const GLOBAL_DEFAULT_PROFILE: MovementProfile = {
  actionType: "hop",
  movementStyle: "grounded",
  eligibleActions: ["idle", "hop"],
  stepDistance: 80,
  hopHeight: 25,
  duration: 500,
  interval: 3000,
  landingPauseMs: 0,
  hoverOffsetY: 0,
  groundOffsetY: 0,
  actionWeights: { hop: 4 },
};

/**
 * Movement profiles registry keyed by species.
 * Each species defines a `default` profile and optional life-stage overrides.
 * Profile resolution merges field-by-field with priority:
 *   exact species+lifeStage → species default → GLOBAL_DEFAULT_PROFILE
 */
export const MOVEMENT_PROFILES: Record<string, SpeciesProfiles> = {
  blob: {
    default: {
      actionType: "hop",
      movementStyle: "grounded",
      eligibleActions: ["idle", "hop", "squish"],
      stepDistance: 80,
      hopHeight: 25,
      duration: 500,
      interval: 3500,
      landingPauseMs: 0,
      hoverOffsetY: 0,
      groundOffsetY: 0,
      actionWeights: { hop: 4, squish: 2, idle: 3 },
    },
    baby: {
      eligibleActions: ["idle", "tinyHop", "bounce"],
      actionWeights: { tinyHop: 4, bounce: 2, idle: 4 },
      stepDistance: 30,
      hopHeight: 8,
    },
    child: {
      eligibleActions: ["idle", "hop", "bounce"],
      actionWeights: { hop: 4, bounce: 2, idle: 3 },
      stepDistance: 60,
      hopHeight: 18,
    },
    adult: {
      eligibleActions: ["idle", "hop", "squish", "squishHop"],
      actionWeights: { hop: 4, squish: 2, squishHop: 2, idle: 3 },
      stepDistance: 100,
      hopHeight: 30,
    },
  },
  frog: {
    default: {
      actionType: "leap",
      movementStyle: "grounded",
      eligibleActions: ["idle", "leap", "hop"],
      stepDistance: 150,
      hopHeight: 60,
      duration: 400,
      interval: 3000,
      landingPauseMs: 350,
      hoverOffsetY: 0,
      groundOffsetY: 0,
      actionWeights: { leap: 5, hop: 2, idle: 3 },
    },
    baby: {
      movementStyle: "floating",
      eligibleActions: ["idle", "bob", "drift"],
      actionWeights: { bob: 4, drift: 3, idle: 3 },
      hoverOffsetY: 12,
      stepDistance: 30,
      hopHeight: 0,
    },
    child: {
      movementStyle: "grounded",
      eligibleActions: ["idle", "smallLeap", "hop"],
      actionWeights: { smallLeap: 4, hop: 3, idle: 3 },
      stepDistance: 100,
      hopHeight: 35,
    },
    adult: {},
  },
};
