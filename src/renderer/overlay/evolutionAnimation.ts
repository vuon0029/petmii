/** Duration of the full evolution animation in milliseconds */
export const EVOLUTION_DURATION_MS = 3500;

export interface EvolutionAnimationState {
  petId: string;
  sessionId: string;
  phase: "rising" | "brightening" | "white" | "revealing" | "descending";
  startedAt: number;
  midpointFired: boolean;
}

/**
 * Returns the current phase name for a given elapsed time.
 */
export function getPhase(
  elapsedMs: number
): EvolutionAnimationState["phase"] {
  const clamped = Math.max(0, Math.min(elapsedMs, EVOLUTION_DURATION_MS));
  if (clamped < 800) return "rising";
  if (clamped < 1600) return "brightening";
  if (clamped < 2200) return "white";
  if (clamped < 2900) return "revealing";
  return "descending";
}

/**
 * Linear interpolation helper.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Easing: ease-out cubic for a gentle deceleration feel.
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Easing: ease-in-out for smooth transitions.
 */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Computes CSS styles for a given elapsed time within the evolution animation.
 *
 * Phase breakdown (total 3500ms — feels like an important moment):
 * - rising (0–800ms): pet floats upward 30px with ease-out, slight scale pulse
 * - brightening (800–1600ms): pet glows white gradually (brightness→0, invert→1)
 * - white (1600–2200ms): full white silhouette, sprite swap happens here invisibly
 * - revealing (1600–2900ms): new model fades in from white (invert→0, brightness→1)
 * - descending (2900–3500ms): pet gently descends back to ground position
 *
 * The midpoint (sprite swap) fires at ~1900ms (center of white phase).
 */
export function computeEvolutionStyles(
  elapsedMs: number
): { transform: string; filter: string; opacity: number } {
  const clamped = Math.max(0, Math.min(elapsedMs, EVOLUTION_DURATION_MS));

  let translateY: number;
  let scale: number;
  let brightness: number;
  let invert: number;
  let dropShadow: string;

  if (clamped < 800) {
    // Rising phase: float upward 30px with ease-out, gentle scale pulse
    const t = easeOutCubic(clamped / 800);
    translateY = lerp(0, -30, t);
    scale = lerp(1, 1.05, t); // subtle grow
    brightness = 1;
    invert = 0;
    // Gentle glow building during rise
    const glowIntensity = Math.round(lerp(0, 4, t));
    dropShadow = glowIntensity > 0
      ? `drop-shadow(0 0 ${glowIntensity}px rgba(255, 255, 255, 0.6))`
      : "";
  } else if (clamped < 1600) {
    // Brightening phase: transition to white silhouette
    const t = easeInOut((clamped - 800) / 800);
    translateY = -30;
    scale = lerp(1.05, 1.08, t); // continue slight grow
    brightness = lerp(1, 0, t);
    invert = lerp(0, 1, t);
    // Intensifying glow
    const glowIntensity = Math.round(lerp(4, 12, t));
    dropShadow = `drop-shadow(0 0 ${glowIntensity}px rgba(255, 255, 255, 0.9))`;
  } else if (clamped < 2200) {
    // White phase: full white silhouette — sprite swap happens here
    translateY = -30;
    scale = 1.08;
    brightness = 0;
    invert = 1;
    // Strong steady glow
    dropShadow = `drop-shadow(0 0 12px rgba(255, 255, 255, 1))`;
  } else if (clamped < 2900) {
    // Revealing phase: new model fades in from white
    const t = easeInOut((clamped - 2200) / 700);
    translateY = -30;
    scale = lerp(1.08, 1.0, t); // settle back to normal size
    brightness = lerp(0, 1, t);
    invert = lerp(1, 0, t);
    // Glow fading
    const glowIntensity = Math.round(lerp(12, 0, t));
    dropShadow = glowIntensity > 0
      ? `drop-shadow(0 0 ${glowIntensity}px rgba(255, 255, 255, 0.7))`
      : "";
  } else {
    // Descending phase: gently return to ground
    const t = easeInOut((clamped - 2900) / 600);
    translateY = lerp(-30, 0, t);
    scale = 1;
    brightness = 1;
    invert = 0;
    dropShadow = "";
  }

  const filterParts = [`brightness(${brightness})`, `invert(${invert})`];
  if (dropShadow) filterParts.push(dropShadow);

  return {
    transform: `translateY(${translateY}px) scale(${scale})`,
    filter: filterParts.join(" "),
    opacity: 1,
  };
}

/**
 * Returns true when elapsed reaches the midpoint (~1900ms, center of white phase) —
 * signals time to swap sprite and commit lifeStage.
 * The caller uses a `midpointFired` flag to ensure it only triggers once.
 */
export function isMidpoint(elapsedMs: number): boolean {
  return elapsedMs >= 1900;
}
