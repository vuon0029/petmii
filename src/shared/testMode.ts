// src/shared/testMode.ts
// Test mode flag and overrides for accelerated gameplay testing.
// Activated by setting PETMII_TEST_MODE=1 environment variable.
//
// Usage: run the app with `PETMII_TEST_MODE=1 npm run dev`
//
// When active, this overrides:
// - Evolution thresholds (babyToChild/childToAdult) → near-instant
// - Shiny chance → 1/4
// - Egg hourly chance → 0.9
// - Autonomous rest/play cooldowns → 10 seconds
// - Autonomous rest/play base chances → higher (triggers faster)

/**
 * Whether test mode is active.
 *
 * Detection strategy:
 * - Main process (Node.js): reads `process.env.PETMII_TEST_MODE` at runtime.
 * - Renderer (Vite): uses `import.meta.env.PETMII_TEST_MODE` which Vite injects
 *   from the environment via `envPrefix: ["PETMII_"]` in electron.vite.config.ts.
 */
function detectTestMode(): boolean {
  // First try Node.js process.env (works in main process)
  try {
    if (typeof process !== "undefined" && process.env && process.env.PETMII_TEST_MODE === "1") {
      return true;
    }
  } catch {
    // Not in Node.js context
  }

  // Then try Vite's import.meta.env (works in renderer)
  try {
    // @ts-ignore
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.PETMII_TEST_MODE === "1") {
      return true;
    }
  } catch {
    // Not in a Vite context
  }

  return false;
}

export const TEST_MODE: boolean = detectTestMode();

if (TEST_MODE) {
  console.log("[petmii] 🧪 TEST MODE ACTIVE — accelerated gameplay values in effect");
}

// ─── Evolution Thresholds ───

/** Test mode evolution threshold (hours) — nearly instant (~36 seconds) */
export const TEST_BABY_TO_CHILD_HOURS = 0.01;
export const TEST_CHILD_TO_ADULT_HOURS = 0.01;

// ─── Shiny Chance ───

/** Test mode shiny chance — 1 in 4 */
export const TEST_SHINY_CHANCE = 1 / 4;

// ─── Egg Discovery ───

/** Test mode egg hourly chance — very high */
export const TEST_EGG_HOURLY_CHANCE = 0.9;

// ─── Autonomous Action Cooldowns ───

/** Test mode cooldown for autonomousRest (ms) — 10 seconds instead of 5 minutes */
export const TEST_AUTONOMOUS_REST_COOLDOWN_MS = 10_000;

/** Test mode cooldown for playTogether (ms) — 10 seconds instead of 2 minutes */
export const TEST_PLAY_TOGETHER_COOLDOWN_MS = 10_000;

/** Test mode base chance for autonomous rest — triggers much more often */
export const TEST_AUTONOMOUS_REST_BASE_CHANCE = 0.3;

/** Test mode base chance for playTogether — triggers much more often */
export const TEST_PLAY_TOGETHER_BASE_CHANCE = 0.3;
