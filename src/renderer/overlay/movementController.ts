/**
 * Movement Controller
 *
 * Handles animation of movement actions (hop, leap, bob, drift) using
 * requestAnimationFrame for smooth per-frame updates. Stationary actions
 * (squish, rest, sleep) apply no position changes.
 *
 * Each animation function returns a cancel function that stops the
 * animation immediately when called.
 */

import { MovementStyle } from "./movementProfiles";

export interface MovementAnimationParams {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  duration: number;
  hopHeight: number;
  landingPauseMs: number;
  movementStyle: MovementStyle;
}

/**
 * Animates a movement action based on the movement style and parameters.
 *
 * - hop/leap (grounded): Arc animation using sine for vertical arc
 * - bob (floating): Small vertical oscillation at hover height
 * - drift (floating): Horizontal movement at hover height
 * - stationary actions: No position changes, fires onComplete after duration + landingPauseMs
 *
 * @param params - Animation parameters including positions, timing, and style
 * @param onFrame - Callback fired each frame with updated (x, y) position
 * @param onComplete - Callback fired when animation + landing pause completes
 * @returns Cancel function that stops the animation immediately
 */
export function animateMovementAction(
  params: MovementAnimationParams,
  onFrame: (x: number, y: number) => void,
  onComplete: () => void
): () => void {
  const { startX, startY, targetX, targetY, duration, hopHeight, landingPauseMs, movementStyle } = params;

  let cancelled = false;
  let animationFrameId: number | null = null;
  let landingTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const cancel = (): void => {
    cancelled = true;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (landingTimeoutId !== null) {
      clearTimeout(landingTimeoutId);
      landingTimeoutId = null;
    }
  };

  // Determine if this is a movement action based on whether there's actual displacement
  // or if it's a floating movement style (bob/drift)
  const isGroundedMovement = movementStyle === "grounded" && (startX !== targetX || startY !== targetY || hopHeight > 0);
  const isFloatingMovement = movementStyle === "floating";

  // If there's no movement to perform (stationary), just wait duration + landingPauseMs
  if (!isGroundedMovement && !isFloatingMovement) {
    const totalDelay = Math.max(0, duration) + Math.max(0, landingPauseMs);
    if (totalDelay > 0) {
      landingTimeoutId = setTimeout(() => {
        if (!cancelled) {
          onComplete();
        }
      }, totalDelay);
    } else {
      // Fire synchronously via microtask for zero-duration stationary
      Promise.resolve().then(() => {
        if (!cancelled) {
          onComplete();
        }
      });
    }
    return cancel;
  }

  const safeDuration = Math.max(1, duration);
  const startTime = performance.now();

  if (isGroundedMovement) {
    // Hop/Leap: arc animation from startX to targetX with sine-based vertical arc
    const animate = (now: number): void => {
      if (cancelled) return;

      const elapsed = now - startTime;
      const progress = Math.min(elapsed / safeDuration, 1);

      // Horizontal: linear interpolation
      const x = startX + (targetX - startX) * progress;

      // Vertical: sine arc (peak at midpoint of animation)
      // sin(π * progress) gives 0 at start, 1 at midpoint, 0 at end
      const arcOffset = Math.sin(Math.PI * progress) * hopHeight;
      const y = startY - arcOffset; // subtract because y-axis increases downward

      onFrame(x, y);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // Animation complete, ensure final position is exact
        onFrame(targetX, startY);
        animationFrameId = null;

        // Hold at landing position for landingPauseMs before completing
        if (landingPauseMs > 0) {
          landingTimeoutId = setTimeout(() => {
            if (!cancelled) {
              onComplete();
            }
          }, landingPauseMs);
        } else {
          onComplete();
        }
      }
    };

    animationFrameId = requestAnimationFrame(animate);
  } else if (isFloatingMovement) {
    // Determine sub-type: bob vs drift
    const isDrift = startX !== targetX;

    if (isDrift) {
      // Drift: horizontal movement at hover height (startY)
      const animate = (now: number): void => {
        if (cancelled) return;

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / safeDuration, 1);

        // Smooth easing for horizontal movement (ease in-out using sine)
        const easedProgress = (1 - Math.cos(Math.PI * progress)) / 2;
        const x = startX + (targetX - startX) * easedProgress;
        const y = startY; // maintain hover height

        onFrame(x, y);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate);
        } else {
          onFrame(targetX, startY);
          animationFrameId = null;

          if (landingPauseMs > 0) {
            landingTimeoutId = setTimeout(() => {
              if (!cancelled) {
                onComplete();
              }
            }, landingPauseMs);
          } else {
            onComplete();
          }
        }
      };

      animationFrameId = requestAnimationFrame(animate);
    } else {
      // Bob: vertical oscillation at hover position
      // Use sine wave for a gentle up-and-down bobbing motion
      const bobAmplitude = 4; // px, small vertical oscillation

      const animate = (now: number): void => {
        if (cancelled) return;

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / safeDuration, 1);

        const x = startX;
        // One full sine cycle for a complete bob (up, down, return)
        const bobOffset = Math.sin(2 * Math.PI * progress) * bobAmplitude;
        const y = startY - bobOffset;

        onFrame(x, y);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate);
        } else {
          // Return to exact hover position
          onFrame(startX, startY);
          animationFrameId = null;

          if (landingPauseMs > 0) {
            landingTimeoutId = setTimeout(() => {
              if (!cancelled) {
                onComplete();
              }
            }, landingPauseMs);
          } else {
            onComplete();
          }
        }
      };

      animationFrameId = requestAnimationFrame(animate);
    }
  }

  return cancel;
}
