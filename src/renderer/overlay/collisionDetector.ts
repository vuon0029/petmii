import type { PhysicsState } from "./actionScheduler";

// ─── Constants ───
export const COLLISION_BUFFER_PX = 8;
export const COLLISION_HALF_BUFFER_PX = 4;
export const HEAD_BUMP_ZONE_RATIO = 0.25;
export const HEAD_BUMP_VX_REDUCTION = 0.15;
export const HEAD_BUMP_DEFLECTION_PX = 1.5;
export const BOUNCE_DAMPING = 0.2;

// ─── Interfaces ───
export interface BoundingBox {
  x: number; // Left edge
  y: number; // Top edge
  width: number; // Rendered width (PET_BASE_SIZE * scale)
  height: number; // Rendered height (PET_BASE_SIZE * scale)
}

export interface CollisionCheckResult {
  collides: boolean;
  blockingPetId: string | null;
  blockingBox: BoundingBox | null;
}

export interface ResolutionResult {
  targetX: number;
  resolved: boolean; // true if an alternative was found, false if staying in place
}

export interface HeadBumpResult {
  collided: boolean;
  newVx: number;
  newVy: number;
  blockingPetId: string | null;
}

// ─── Eligible states per mode ───
const GROUND_ELIGIBLE_STATES: Set<PhysicsState> = new Set<PhysicsState>(["idle"]);
const HEAD_BUMP_ELIGIBLE_STATES: Set<PhysicsState> = new Set<PhysicsState>(["idle", "gettingUp"]);

/**
 * Checks if a proposed bounding box overlaps with any blocker pet's bounding box.
 * Uses AABB overlap test: two boxes collide when the horizontal distance between
 * their centers is less than width + COLLISION_BUFFER_PX.
 * This is equivalent to expanding each box by COLLISION_HALF_BUFFER_PX on each side.
 *
 * @param proposedBox - The bounding box of the pet at the proposed position
 * @param blockers - Array of eligible blocker pets with their bounding boxes
 * @returns CollisionCheckResult with the first blocking pet found, or no-collision
 */
export function checkOverlap(
  proposedBox: BoundingBox,
  blockers: Array<{ id: string; box: BoundingBox }>,
): CollisionCheckResult {
  const proposedCenterX = proposedBox.x + proposedBox.width / 2;

  for (const blocker of blockers) {
    const blockerCenterX = blocker.box.x + blocker.box.width / 2;
    const horizontalDistance = Math.abs(proposedCenterX - blockerCenterX);

    // Overlap occurs when center distance < width + COLLISION_BUFFER_PX
    // This is equivalent to expanding each box by COLLISION_HALF_BUFFER_PX on each side
    if (horizontalDistance < proposedBox.width + COLLISION_BUFFER_PX) {
      return {
        collides: true,
        blockingPetId: blocker.id,
        blockingBox: blocker.box,
      };
    }
  }

  return {
    collides: false,
    blockingPetId: null,
    blockingBox: null,
  };
}

/**
 * Resolves a collision by attempting opposite-side placement.
 * Places the pet at stepDistance from current position on the side opposite to the blocker.
 * Verifies the alternative position does not overlap any other blocker (single attempt, no recursion).
 * Checks that the alternative position is within screen bounds.
 * Returns { resolved: false, targetX: currentX } if no valid alternative exists.
 *
 * @param currentX - The pet's current X position
 * @param originalTargetX - The original target X that caused a collision
 * @param stepDistance - The pet's step distance for movement
 * @param petWidth - The rendered width of the pet
 * @param blockers - Array of eligible blocker pets with their bounding boxes
 * @param screenMinX - Minimum screen X bound
 * @param screenMaxX - Maximum screen X bound
 * @returns ResolutionResult with the adjusted target or current position
 */
export function resolveCollision(
  currentX: number,
  originalTargetX: number,
  stepDistance: number,
  petWidth: number,
  blockers: Array<{ id: string; box: BoundingBox }>,
  screenMinX: number,
  screenMaxX: number,
): ResolutionResult {
  // Determine the original movement direction
  const originalDirection = originalTargetX >= currentX ? 1 : -1;

  // Opposite-side placement: move in the opposite direction from the blocker
  const oppositeDirection = -originalDirection;
  const alternativeX = currentX + oppositeDirection * stepDistance;

  // Check screen bounds: the pet's left edge must be >= screenMinX
  // and the pet's right edge (alternativeX + petWidth) must be <= screenMaxX
  if (alternativeX < screenMinX || alternativeX + petWidth > screenMaxX) {
    return { resolved: false, targetX: currentX };
  }

  // Verify alternative position does not overlap any blocker (single attempt, no recursion)
  const alternativeBox: BoundingBox = {
    x: alternativeX,
    y: 0, // Y is not relevant for horizontal collision resolution
    width: petWidth,
    height: petWidth,
  };

  const overlapCheck = checkOverlap(alternativeBox, blockers);

  if (overlapCheck.collides) {
    // No valid alternative exists
    return { resolved: false, targetX: currentX };
  }

  return { resolved: true, targetX: alternativeX };
}

/**
 * Detects head-bump collision for a flying pet against eligible blockers.
 * A head-bump occurs when:
 *   1. The flying pet has downward velocity (vy > 0)
 *   2. The flying pet's bottom edge is within the top 25% of the blocker's height
 *   3. There is horizontal overlap between the flying pet and the blocker
 *
 * Returns updated velocities if collision detected (first hit only).
 *
 * @param flyingBox - The bounding box of the flying pet
 * @param flyingVx - Current horizontal velocity of the flying pet
 * @param flyingVy - Current vertical velocity of the flying pet (positive = downward)
 * @param blockers - Array of eligible blocker pets with their bounding boxes
 * @returns HeadBumpResult with collision status and post-collision velocities
 */
export function detectHeadBump(
  flyingBox: BoundingBox,
  flyingVx: number,
  flyingVy: number,
  blockers: Array<{ id: string; box: BoundingBox }>,
): HeadBumpResult {
  // Head-bump only triggers when moving downward
  if (flyingVy <= 0) {
    return { collided: false, newVx: flyingVx, newVy: flyingVy, blockingPetId: null };
  }

  const flyingBottom = flyingBox.y + flyingBox.height;
  const flyingCenterX = flyingBox.x + flyingBox.width / 2;

  for (const blocker of blockers) {
    const blockerTop = blocker.box.y;
    const blockerHeight = blocker.box.height;
    const headBumpZoneBottom = blockerTop + blockerHeight * HEAD_BUMP_ZONE_RATIO;

    // Check vertical condition: flying pet's bottom edge is within top 25% of blocker
    if (flyingBottom > blockerTop && flyingBottom <= headBumpZoneBottom) {
      // Check horizontal overlap (AABB overlap on horizontal axis)
      const flyingLeft = flyingBox.x;
      const flyingRight = flyingBox.x + flyingBox.width;
      const blockerLeft = blocker.box.x;
      const blockerRight = blocker.box.x + blocker.box.width;

      if (flyingRight > blockerLeft && flyingLeft < blockerRight) {
        // Collision detected — compute post-collision velocities
        const newVy = -flyingVy * BOUNCE_DAMPING;

        // Deflection: push away from blocker's center
        const blockerCenterX = blocker.box.x + blocker.box.width / 2;
        const deflection = flyingCenterX < blockerCenterX
          ? -HEAD_BUMP_DEFLECTION_PX
          : HEAD_BUMP_DEFLECTION_PX;

        const newVx = flyingVx * (1 - HEAD_BUMP_VX_REDUCTION) + deflection;

        return {
          collided: true,
          newVx,
          newVy,
          blockingPetId: blocker.id,
        };
      }
    }
  }

  return { collided: false, newVx: flyingVx, newVy: flyingVy, blockingPetId: null };
}

/**
 * Computes the stop position for an approaching pet when it hits a blocker.
 * The pet stops so that its bounding box edge is exactly COLLISION_HALF_BUFFER_PX (4px)
 * from the blocking pet's nearest edge, on the side from which it approached.
 *
 * @param approachDirection - 1 if approaching from the left, -1 if approaching from the right
 * @param blockerBox - The bounding box of the blocking pet
 * @param petWidth - The rendered width of the approaching pet
 * @returns The left-edge X position where the approaching pet should stop
 */
export function computeApproachStopX(
  approachDirection: 1 | -1,
  blockerBox: BoundingBox,
  petWidth: number,
): number {
  if (approachDirection === 1) {
    // Approaching from the left: pet stops to the left of the blocker
    // Pet's right edge should be COLLISION_HALF_BUFFER_PX away from blocker's left edge
    return blockerBox.x - petWidth - COLLISION_HALF_BUFFER_PX;
  } else {
    // Approaching from the right: pet stops to the right of the blocker
    // Pet's left edge should be COLLISION_HALF_BUFFER_PX away from blocker's right edge
    return blockerBox.x + blockerBox.width + COLLISION_HALF_BUFFER_PX;
  }
}

/**
 * Corrects spawn positions when two pets are within the collision buffer.
 * Displaces each pet equally in opposite horizontal directions so that
 * the resulting edge-to-edge gap is exactly COLLISION_BUFFER_PX (8 pixels).
 * Clamps positions within screen bounds [screenMinX, screenMaxX - petWidth].
 *
 * Edge-to-edge distance is computed as: |pet2X - pet1X| - petWidth
 * (assuming pet2X > pet1X; same logic applies symmetrically).
 *
 * @param pet1X - Current X position of pet 1
 * @param pet2X - Current X position of pet 2
 * @param petWidth - Rendered width of each pet (PET_BASE_SIZE * scale)
 * @param screenMinX - Minimum allowed X position (left bound)
 * @param screenMaxX - Maximum allowed X position (right bound, rightmost pixel + 1)
 * @returns Adjusted positions for both pets
 */
export function correctSpawnOverlap(
  pet1X: number,
  pet2X: number,
  petWidth: number,
  screenMinX: number,
  screenMaxX: number,
): { pet1X: number; pet2X: number } {
  // Determine which pet is on the left and which is on the right
  const leftX = Math.min(pet1X, pet2X);
  const rightX = Math.max(pet1X, pet2X);

  // Edge-to-edge distance: gap between the right edge of the left pet and left edge of the right pet
  const edgeToEdge = rightX - leftX - petWidth;

  // If already at or beyond the required buffer, no correction needed
  if (edgeToEdge >= COLLISION_BUFFER_PX) {
    return { pet1X, pet2X };
  }

  // Calculate how much total displacement is needed to achieve exactly 8px gap
  // Required gap is COLLISION_BUFFER_PX, current gap is edgeToEdge
  const totalDisplacement = COLLISION_BUFFER_PX - edgeToEdge;

  // Each pet is displaced equally: half the total displacement each
  const halfDisplacement = totalDisplacement / 2;

  // Move the left pet further left, and the right pet further right
  let newLeftX = leftX - halfDisplacement;
  let newRightX = rightX + halfDisplacement;

  // Clamp within screen bounds: [screenMinX, screenMaxX - petWidth]
  const maxAllowedX = screenMaxX - petWidth;

  if (newLeftX < screenMinX) {
    // Left pet hit the left wall; shift the right pet to compensate
    const overflow = screenMinX - newLeftX;
    newLeftX = screenMinX;
    newRightX = newRightX + overflow;
  }

  if (newRightX > maxAllowedX) {
    // Right pet hit the right wall; shift the left pet to compensate
    const overflow = newRightX - maxAllowedX;
    newRightX = maxAllowedX;
    newLeftX = newLeftX - overflow;
  }

  // Final clamp in case both walls are hit (very narrow screen)
  newLeftX = Math.max(screenMinX, newLeftX);
  newRightX = Math.min(maxAllowedX, newRightX);

  // Return in the original order (pet1X was left or right?)
  if (pet1X <= pet2X) {
    return { pet1X: newLeftX, pet2X: newRightX };
  } else {
    return { pet1X: newRightX, pet2X: newLeftX };
  }
}

/**
 * Validates and adjusts play-together positions to maintain spacing within viewport bounds.
 *
 * The function enforces:
 * 1. Center-to-center distance is >= max(petWidth, minSpacing) and <= maxSpacing
 * 2. Both pets are within viewport bounds [0, viewportWidth - petWidth]
 * 3. If viewport is too narrow for both pets at minimum spacing, cancels the session
 *
 * @param pet1X - Proposed left-edge X position of pet 1
 * @param pet2X - Proposed left-edge X position of pet 2
 * @param petWidth - Rendered width of each pet (PET_BASE_SIZE * scale)
 * @param viewportWidth - Total viewport width in pixels
 * @param minSpacing - Minimum center-to-center distance (e.g., 50px)
 * @param maxSpacing - Maximum center-to-center distance (e.g., 80px)
 * @returns Adjusted positions and cancelled flag
 */
export function validatePlayPositions(
  pet1X: number,
  pet2X: number,
  petWidth: number,
  viewportWidth: number,
  minSpacing: number,
  maxSpacing: number,
): { pet1X: number; pet2X: number; cancelled: boolean } {
  // Effective minimum center-to-center distance is max(petWidth, minSpacing)
  const effectiveMinSpacing = Math.max(petWidth, minSpacing);

  // Check if both pets can fit within viewport at the effective minimum spacing.
  // The total width occupied by two pets at minimum spacing:
  // leftPet occupies [leftX, leftX + petWidth], rightPet occupies [rightX, rightX + petWidth]
  // Center-to-center distance = rightX - leftX + 0 (since center = x + petWidth/2, distance = (rightX + pw/2) - (leftX + pw/2) = rightX - leftX... wait)
  // Actually: center1 = pet1X + petWidth/2, center2 = pet2X + petWidth/2
  // center-to-center = |pet2X - pet1X| (since petWidth/2 cancels out)
  // For two pets to fit: the left pet's left edge >= 0, right pet's right edge <= viewportWidth
  // If left pet is at position L, right pet is at L + effectiveMinSpacing (center-to-center)
  // Left edge of left pet = L, right edge of right pet = L + effectiveMinSpacing + petWidth
  // So total width required = effectiveMinSpacing + petWidth
  // Cancellation condition: effectiveMinSpacing + petWidth > viewportWidth
  if (effectiveMinSpacing + petWidth > viewportWidth) {
    return { pet1X, pet2X, cancelled: true };
  }

  // Determine left and right pets
  let leftX = Math.min(pet1X, pet2X);
  let rightX = Math.max(pet1X, pet2X);
  const pet1IsLeft = pet1X <= pet2X;

  // Compute current center-to-center distance
  // center1 = leftX + petWidth/2, center2 = rightX + petWidth/2
  // distance = rightX - leftX
  let centerDistance = rightX - leftX;

  // Enforce minimum spacing: if distance < effectiveMinSpacing, spread them apart equally
  if (centerDistance < effectiveMinSpacing) {
    const midpoint = (leftX + rightX) / 2;
    leftX = midpoint - effectiveMinSpacing / 2;
    rightX = midpoint + effectiveMinSpacing / 2;
    centerDistance = effectiveMinSpacing;
  }

  // Enforce maximum spacing: if distance > maxSpacing, bring them closer equally
  if (centerDistance > maxSpacing) {
    const midpoint = (leftX + rightX) / 2;
    leftX = midpoint - maxSpacing / 2;
    rightX = midpoint + maxSpacing / 2;
    centerDistance = maxSpacing;
  }

  // Now enforce viewport bounds while preserving spacing
  // Left pet's left edge must be >= 0
  // Right pet's right edge (rightX + petWidth) must be <= viewportWidth
  const maxAllowedX = viewportWidth - petWidth;

  if (leftX < 0) {
    // Shift both right by the minimum offset to bring left pet to 0
    const offset = -leftX;
    leftX += offset;
    rightX += offset;
  }

  if (rightX > maxAllowedX) {
    // Shift both left by the minimum offset to bring right pet within bounds
    const offset = rightX - maxAllowedX;
    leftX -= offset;
    rightX -= offset;
  }

  // After shifting, if left pet is still out of bounds, it means viewport is too small
  // (This shouldn't happen because we checked cancellation above, but be safe)
  if (leftX < 0 || rightX > maxAllowedX) {
    return { pet1X, pet2X, cancelled: true };
  }

  // Return in original order
  if (pet1IsLeft) {
    return { pet1X: leftX, pet2X: rightX, cancelled: false };
  } else {
    return { pet1X: rightX, pet2X: leftX, cancelled: false };
  }
}

/**
 * Filters pets to eligible blockers based on physicsState.
 * For ground movement: only "idle" pets.
 * For head-bumps: "idle" or "gettingUp" pets.
 *
 * @param pets - Array of pet state objects with id, physicsState, position
 * @param excludePetId - The pet performing the movement (excluded from blockers)
 * @param mode - "ground" for movement collision, "headBump" for flying collision
 * @param petSize - Rendered pet size (PET_BASE_SIZE * scale)
 * @returns Array of eligible blockers with their bounding boxes
 */
export function getEligibleBlockers(
  pets: Array<{ id: string; physicsState: PhysicsState; x: number; y: number }>,
  excludePetId: string,
  mode: "ground" | "headBump",
  petSize: number,
): Array<{ id: string; box: BoundingBox }> {
  const eligibleStates = mode === "ground" ? GROUND_ELIGIBLE_STATES : HEAD_BUMP_ELIGIBLE_STATES;

  return pets
    .filter((pet) => pet.id !== excludePetId && eligibleStates.has(pet.physicsState))
    .map((pet) => ({
      id: pet.id,
      box: {
        x: pet.x,
        y: pet.y,
        width: petSize,
        height: petSize,
      },
    }));
}
