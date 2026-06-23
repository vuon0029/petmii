import { describe, it, expect } from "vitest";
import {
  checkOverlap,
  resolveCollision,
  computeApproachStopX,
  correctSpawnOverlap,
  detectHeadBump,
  validatePlayPositions,
  COLLISION_BUFFER_PX,
  COLLISION_HALF_BUFFER_PX,
  HEAD_BUMP_ZONE_RATIO,
  HEAD_BUMP_VX_REDUCTION,
  HEAD_BUMP_DEFLECTION_PX,
  BOUNCE_DAMPING,
  type BoundingBox,
} from "../collisionDetector";

describe("checkOverlap", () => {
  const petWidth = 72;

  it("returns no collision when no blockers exist", () => {
    const proposedBox: BoundingBox = { x: 100, y: 0, width: petWidth, height: petWidth };
    const result = checkOverlap(proposedBox, []);
    expect(result.collides).toBe(false);
    expect(result.blockingPetId).toBeNull();
  });

  it("detects collision when boxes overlap horizontally", () => {
    const proposedBox: BoundingBox = { x: 100, y: 0, width: petWidth, height: petWidth };
    const blockers = [{ id: "pet-2", box: { x: 150, y: 0, width: petWidth, height: petWidth } }];
    const result = checkOverlap(proposedBox, blockers);
    expect(result.collides).toBe(true);
    expect(result.blockingPetId).toBe("pet-2");
  });

  it("returns no collision when boxes are exactly at buffer distance", () => {
    // Pet at x=0, center = 36. Blocker at x=80, center = 116.
    // Distance = 80. Threshold = 72 + 8 = 80. Distance is NOT less than threshold.
    const proposedBox: BoundingBox = { x: 0, y: 0, width: petWidth, height: petWidth };
    const blockers = [{ id: "pet-2", box: { x: 80, y: 0, width: petWidth, height: petWidth } }];
    const result = checkOverlap(proposedBox, blockers);
    expect(result.collides).toBe(false);
  });

  it("detects collision when boxes are just inside buffer distance", () => {
    // Pet at x=0, center = 36. Blocker at x=79, center = 115.
    // Distance = 79. Threshold = 72 + 8 = 80. 79 < 80 → collision.
    const proposedBox: BoundingBox = { x: 0, y: 0, width: petWidth, height: petWidth };
    const blockers = [{ id: "pet-2", box: { x: 79, y: 0, width: petWidth, height: petWidth } }];
    const result = checkOverlap(proposedBox, blockers);
    expect(result.collides).toBe(true);
  });

  it("returns first blocking pet when multiple blockers overlap", () => {
    const proposedBox: BoundingBox = { x: 100, y: 0, width: petWidth, height: petWidth };
    const blockers = [
      { id: "pet-2", box: { x: 120, y: 0, width: petWidth, height: petWidth } },
      { id: "pet-3", box: { x: 110, y: 0, width: petWidth, height: petWidth } },
    ];
    const result = checkOverlap(proposedBox, blockers);
    expect(result.collides).toBe(true);
    expect(result.blockingPetId).toBe("pet-2");
  });
});

describe("resolveCollision", () => {
  const petWidth = 72;
  const stepDistance = 50;
  const screenMinX = 0;
  const screenMaxX = 1920;

  it("resolves to opposite side when original target is to the right", () => {
    // Pet at x=500, target at x=550 (moving right), blocker at x=540
    const blockers = [{ id: "pet-2", box: { x: 540, y: 0, width: petWidth, height: petWidth } }];
    const result = resolveCollision(500, 550, stepDistance, petWidth, blockers, screenMinX, screenMaxX);
    // Opposite side is left: 500 + (-1) * 50 = 450
    expect(result.resolved).toBe(true);
    expect(result.targetX).toBe(450);
  });

  it("resolves to opposite side when original target is to the left", () => {
    // Pet at x=500, target at x=450 (moving left), blocker at x=460
    const blockers = [{ id: "pet-2", box: { x: 460, y: 0, width: petWidth, height: petWidth } }];
    const result = resolveCollision(500, 450, stepDistance, petWidth, blockers, screenMinX, screenMaxX);
    // Opposite side is right: 500 + 1 * 50 = 550
    expect(result.resolved).toBe(true);
    expect(result.targetX).toBe(550);
  });

  it("returns unresolved when alternative is out of bounds (left edge)", () => {
    // Pet at x=30, target at x=80 (moving right), blocker at x=70
    // Opposite side: 30 + (-1) * 50 = -20 → out of bounds
    const blockers = [{ id: "pet-2", box: { x: 70, y: 0, width: petWidth, height: petWidth } }];
    const result = resolveCollision(30, 80, stepDistance, petWidth, blockers, screenMinX, screenMaxX);
    expect(result.resolved).toBe(false);
    expect(result.targetX).toBe(30);
  });

  it("returns unresolved when alternative is out of bounds (right edge)", () => {
    // Pet at x=1880, target at x=1830 (moving left), blocker at x=1840
    // Opposite side: 1880 + 1 * 50 = 1930; right edge = 1930 + 72 = 2002 > 1920
    const blockers = [{ id: "pet-2", box: { x: 1840, y: 0, width: petWidth, height: petWidth } }];
    const result = resolveCollision(1880, 1830, stepDistance, petWidth, blockers, screenMinX, screenMaxX);
    expect(result.resolved).toBe(false);
    expect(result.targetX).toBe(1880);
  });

  it("returns unresolved when alternative position also overlaps another blocker", () => {
    // Pet at x=500, target at x=550 (moving right), blocker-1 at x=540
    // Opposite side: x=450; but blocker-2 is at x=440 (will overlap with x=450)
    const blockers = [
      { id: "pet-1", box: { x: 540, y: 0, width: petWidth, height: petWidth } },
      { id: "pet-2", box: { x: 440, y: 0, width: petWidth, height: petWidth } },
    ];
    const result = resolveCollision(500, 550, stepDistance, petWidth, blockers, screenMinX, screenMaxX);
    expect(result.resolved).toBe(false);
    expect(result.targetX).toBe(500);
  });

  it("resolves when alternative is within bounds and free of blockers", () => {
    // Pet at x=500, target at x=550, blocker at x=540
    // Alternative: x=450, no blockers there
    const blockers = [{ id: "pet-2", box: { x: 540, y: 0, width: petWidth, height: petWidth } }];
    const result = resolveCollision(500, 550, stepDistance, petWidth, blockers, screenMinX, screenMaxX);
    expect(result.resolved).toBe(true);
    expect(result.targetX).toBe(450);
  });

  it("alternative position is exactly stepDistance from current position", () => {
    const currentX = 600;
    const blockers = [{ id: "pet-2", box: { x: 640, y: 0, width: petWidth, height: petWidth } }];
    const result = resolveCollision(currentX, 650, stepDistance, petWidth, blockers, screenMinX, screenMaxX);
    expect(result.resolved).toBe(true);
    expect(Math.abs(result.targetX - currentX)).toBe(stepDistance);
  });
});

describe("computeApproachStopX", () => {
  const petWidth = 72;

  it("stops to the left of the blocker when approaching from the left (direction = 1)", () => {
    const blockerBox: BoundingBox = { x: 300, y: 0, width: petWidth, height: petWidth };
    const stopX = computeApproachStopX(1, blockerBox, petWidth);
    // stopX = blockerBox.x - petWidth - COLLISION_HALF_BUFFER_PX = 300 - 72 - 4 = 224
    expect(stopX).toBe(300 - petWidth - COLLISION_HALF_BUFFER_PX);
    expect(stopX).toBe(224);
  });

  it("stops to the right of the blocker when approaching from the right (direction = -1)", () => {
    const blockerBox: BoundingBox = { x: 300, y: 0, width: petWidth, height: petWidth };
    const stopX = computeApproachStopX(-1, blockerBox, petWidth);
    // stopX = blockerBox.x + blockerBox.width + COLLISION_HALF_BUFFER_PX = 300 + 72 + 4 = 376
    expect(stopX).toBe(300 + petWidth + COLLISION_HALF_BUFFER_PX);
    expect(stopX).toBe(376);
  });

  it("maintains exactly COLLISION_HALF_BUFFER_PX gap from blocker edge (left approach)", () => {
    const blockerBox: BoundingBox = { x: 500, y: 0, width: petWidth, height: petWidth };
    const stopX = computeApproachStopX(1, blockerBox, petWidth);
    // Pet's right edge = stopX + petWidth, gap = blockerBox.x - (stopX + petWidth)
    const gap = blockerBox.x - (stopX + petWidth);
    expect(gap).toBe(COLLISION_HALF_BUFFER_PX);
  });

  it("maintains exactly COLLISION_HALF_BUFFER_PX gap from blocker edge (right approach)", () => {
    const blockerBox: BoundingBox = { x: 500, y: 0, width: petWidth, height: petWidth };
    const stopX = computeApproachStopX(-1, blockerBox, petWidth);
    // Pet's left edge = stopX, gap = stopX - (blockerBox.x + blockerBox.width)
    const gap = stopX - (blockerBox.x + blockerBox.width);
    expect(gap).toBe(COLLISION_HALF_BUFFER_PX);
  });
});

describe("detectHeadBump", () => {
  const petSize = 72;

  it("returns no collision when vy <= 0 (moving upward)", () => {
    const flyingBox: BoundingBox = { x: 100, y: 50, width: petSize, height: petSize };
    const blockers = [{ id: "pet-2", box: { x: 100, y: 100, width: petSize, height: petSize } }];
    const result = detectHeadBump(flyingBox, 5, -3, blockers);
    expect(result.collided).toBe(false);
    expect(result.newVx).toBe(5);
    expect(result.newVy).toBe(-3);
    expect(result.blockingPetId).toBeNull();
  });

  it("returns no collision when vy is exactly 0 (stationary vertically)", () => {
    const flyingBox: BoundingBox = { x: 100, y: 50, width: petSize, height: petSize };
    const blockers = [{ id: "pet-2", box: { x: 100, y: 100, width: petSize, height: petSize } }];
    const result = detectHeadBump(flyingBox, 5, 0, blockers);
    expect(result.collided).toBe(false);
  });

  it("returns no collision when no blockers exist", () => {
    const flyingBox: BoundingBox = { x: 100, y: 50, width: petSize, height: petSize };
    const result = detectHeadBump(flyingBox, 5, 3, []);
    expect(result.collided).toBe(false);
  });

  it("detects head-bump when flying pet's bottom is within top 25% of blocker", () => {
    // Blocker at y=100, height=72. Top 25% zone = [100, 118].
    // Flying pet at y=40, height=72. Bottom edge = 112. Within [100, 118].
    // Horizontal overlap: flying x=100, blocker x=100. Same position → full overlap.
    const flyingBox: BoundingBox = { x: 100, y: 40, width: petSize, height: petSize };
    const blockers = [{ id: "pet-2", box: { x: 100, y: 100, width: petSize, height: petSize } }];
    const result = detectHeadBump(flyingBox, 5, 3, blockers);
    expect(result.collided).toBe(true);
    expect(result.blockingPetId).toBe("pet-2");
  });

  it("does NOT trigger when bottom edge is below top 25% zone", () => {
    // Blocker at y=100, height=72. Top 25% zone bottom = 100 + 72*0.25 = 118.
    // Flying pet bottom = 119 → just below the zone.
    const flyingBox: BoundingBox = { x: 100, y: 47, width: petSize, height: petSize };
    const blockers = [{ id: "pet-2", box: { x: 100, y: 100, width: petSize, height: petSize } }];
    const result = detectHeadBump(flyingBox, 5, 3, blockers);
    expect(result.collided).toBe(false);
  });

  it("does NOT trigger when there is no horizontal overlap", () => {
    // Flying pet fully to the left of blocker (no horizontal overlap)
    const flyingBox: BoundingBox = { x: 10, y: 40, width: petSize, height: petSize };
    const blockers = [{ id: "pet-2", box: { x: 200, y: 100, width: petSize, height: petSize } }];
    const result = detectHeadBump(flyingBox, 5, 3, blockers);
    expect(result.collided).toBe(false);
  });

  it("computes correct post-collision newVy (reversed and damped)", () => {
    const flyingBox: BoundingBox = { x: 100, y: 40, width: petSize, height: petSize };
    const blockers = [{ id: "pet-2", box: { x: 100, y: 100, width: petSize, height: petSize } }];
    const vy = 10;
    const result = detectHeadBump(flyingBox, 5, vy, blockers);
    expect(result.collided).toBe(true);
    // newVy = -vy * BOUNCE_DAMPING = -10 * 0.2 = -2
    expect(result.newVy).toBeCloseTo(-vy * BOUNCE_DAMPING);
  });

  it("computes correct post-collision newVx with deflection away from blocker center", () => {
    // Flying pet center is LEFT of blocker center → deflect left (negative)
    // Flying at x=80, center=116. Blocker at x=100, center=136. 116 < 136 → deflect left.
    const flyingBox: BoundingBox = { x: 80, y: 40, width: petSize, height: petSize };
    const blockers = [{ id: "pet-2", box: { x: 100, y: 100, width: petSize, height: petSize } }];
    const vx = 5;
    const result = detectHeadBump(flyingBox, vx, 3, blockers);
    expect(result.collided).toBe(true);
    // newVx = vx * (1 - 0.15) + (-1.5) = 5 * 0.85 - 1.5 = 4.25 - 1.5 = 2.75
    const expectedNewVx = vx * (1 - HEAD_BUMP_VX_REDUCTION) - HEAD_BUMP_DEFLECTION_PX;
    expect(result.newVx).toBeCloseTo(expectedNewVx);
  });

  it("deflects right when flying pet center is right of blocker center", () => {
    // Flying at x=120, center=156. Blocker at x=100, center=136. 156 > 136 → deflect right.
    const flyingBox: BoundingBox = { x: 120, y: 40, width: petSize, height: petSize };
    const blockers = [{ id: "pet-2", box: { x: 100, y: 100, width: petSize, height: petSize } }];
    const vx = 5;
    const result = detectHeadBump(flyingBox, vx, 3, blockers);
    expect(result.collided).toBe(true);
    // newVx = vx * (1 - 0.15) + 1.5 = 5 * 0.85 + 1.5 = 4.25 + 1.5 = 5.75
    const expectedNewVx = vx * (1 - HEAD_BUMP_VX_REDUCTION) + HEAD_BUMP_DEFLECTION_PX;
    expect(result.newVx).toBeCloseTo(expectedNewVx);
  });

  it("returns first collision hit only (stops after first blocker)", () => {
    // Both blockers are valid hits, but only the first should be returned
    const flyingBox: BoundingBox = { x: 100, y: 40, width: petSize, height: petSize };
    const blockers = [
      { id: "pet-2", box: { x: 100, y: 100, width: petSize, height: petSize } },
      { id: "pet-3", box: { x: 110, y: 100, width: petSize, height: petSize } },
    ];
    const result = detectHeadBump(flyingBox, 5, 3, blockers);
    expect(result.collided).toBe(true);
    expect(result.blockingPetId).toBe("pet-2");
  });

  it("detects collision at exact boundary of top 25% zone", () => {
    // Blocker at y=100, height=72. Zone bottom = 100 + 72*0.25 = 118.
    // Flying pet bottom exactly at 118 → should trigger (flyingBottom <= headBumpZoneBottom).
    const flyingBox: BoundingBox = { x: 100, y: 46, width: petSize, height: petSize };
    const blockers = [{ id: "pet-2", box: { x: 100, y: 100, width: petSize, height: petSize } }];
    const result = detectHeadBump(flyingBox, 5, 3, blockers);
    expect(result.collided).toBe(true);
  });

  it("does NOT trigger when flying pet bottom is above the blocker top", () => {
    // Flying pet bottom = 90, blocker top = 100. 90 <= 100 is false for > check.
    const flyingBox: BoundingBox = { x: 100, y: 18, width: petSize, height: petSize };
    const blockers = [{ id: "pet-2", box: { x: 100, y: 100, width: petSize, height: petSize } }];
    const result = detectHeadBump(flyingBox, 5, 3, blockers);
    expect(result.collided).toBe(false);
  });
});

describe("correctSpawnOverlap", () => {
  const petWidth = 72;
  const screenMinX = 0;
  const screenMaxX = 1920;

  it("returns positions unchanged when pets are already far apart", () => {
    // Edge-to-edge distance = 200 - 0 - 72 = 128 >= 8
    const result = correctSpawnOverlap(0, 200, petWidth, screenMinX, screenMaxX);
    expect(result.pet1X).toBe(0);
    expect(result.pet2X).toBe(200);
  });

  it("displaces pets equally when they overlap", () => {
    // Both at x=100, edge-to-edge = 0 - 72 = -72 (fully overlapping)
    // totalDisplacement = 8 - (-72) = 80, halfDisplacement = 40
    // newLeft = 100 - 40 = 60, newRight = 100 + 40 = 140
    const result = correctSpawnOverlap(100, 100, petWidth, screenMinX, screenMaxX);
    // Both displaced equally
    expect(result.pet1X).toBe(60);
    expect(result.pet2X).toBe(140);
    // Resulting edge-to-edge gap = 140 - 60 - 72 = 8
    expect(result.pet2X - result.pet1X - petWidth).toBe(COLLISION_BUFFER_PX);
  });

  it("produces exactly 8px edge-to-edge gap after correction", () => {
    // Pets at x=100 and x=170, edge-to-edge = 170 - 100 - 72 = -2 (slight overlap)
    // totalDisplacement = 8 - (-2) = 10, halfDisplacement = 5
    // newLeft = 100 - 5 = 95, newRight = 170 + 5 = 175
    const result = correctSpawnOverlap(100, 170, petWidth, screenMinX, screenMaxX);
    const gap = result.pet2X - result.pet1X - petWidth;
    expect(gap).toBe(COLLISION_BUFFER_PX);
  });

  it("handles pet1 to the right of pet2 (reversed order)", () => {
    // pet1X=200, pet2X=100; left=100, right=200
    // edge-to-edge = 200 - 100 - 72 = 28 >= 8 → no correction needed? 
    // Actually 28 >= 8, so no correction
    const result = correctSpawnOverlap(200, 100, petWidth, screenMinX, screenMaxX);
    expect(result.pet1X).toBe(200);
    expect(result.pet2X).toBe(100);
  });

  it("handles reversed order with overlap", () => {
    // pet1X=150, pet2X=100; left=100, right=150
    // edge-to-edge = 150 - 100 - 72 = -22
    // totalDisplacement = 8 - (-22) = 30, halfDisplacement = 15
    // newLeft = 100 - 15 = 85, newRight = 150 + 15 = 165
    const result = correctSpawnOverlap(150, 100, petWidth, screenMinX, screenMaxX);
    // pet1 was right (150), pet2 was left (100)
    expect(result.pet1X).toBe(165);
    expect(result.pet2X).toBe(85);
    expect(result.pet1X - result.pet2X - petWidth).toBe(COLLISION_BUFFER_PX);
  });

  it("clamps left pet to screen bounds when near left edge", () => {
    // pet1 at x=2, pet2 at x=5, edge-to-edge = 5 - 2 - 72 = -69
    // totalDisplacement = 8 - (-69) = 77, halfDisplacement = 38.5
    // newLeft = 2 - 38.5 = -36.5 → clamp to 0, shift right by 36.5
    // newRight = 5 + 38.5 + 36.5 = 80
    const result = correctSpawnOverlap(2, 5, petWidth, screenMinX, screenMaxX);
    expect(result.pet1X).toBeGreaterThanOrEqual(screenMinX);
    expect(result.pet2X).toBeGreaterThanOrEqual(screenMinX);
    expect(result.pet2X - result.pet1X - petWidth).toBe(COLLISION_BUFFER_PX);
  });

  it("clamps right pet to screen bounds when near right edge", () => {
    const maxX = screenMaxX - petWidth; // 1848
    const result = correctSpawnOverlap(maxX - 2, maxX, petWidth, screenMinX, screenMaxX);
    expect(result.pet1X).toBeGreaterThanOrEqual(screenMinX);
    expect(result.pet2X).toBeLessThanOrEqual(maxX);
    const gap = result.pet2X - result.pet1X - petWidth;
    expect(gap).toBe(COLLISION_BUFFER_PX);
  });

  it("handles edge-to-edge distance of exactly 7 (just under buffer)", () => {
    // Edge-to-edge = petWidth + 7 gap: pet2X = pet1X + petWidth + 7
    const pet1X = 100;
    const pet2X = pet1X + petWidth + 7; // 179
    const result = correctSpawnOverlap(pet1X, pet2X, petWidth, screenMinX, screenMaxX);
    const gap = result.pet2X - result.pet1X - petWidth;
    expect(gap).toBe(COLLISION_BUFFER_PX);
    // Each displaced by 0.5 px
    expect(result.pet1X).toBe(pet1X - 0.5);
    expect(result.pet2X).toBe(pet2X + 0.5);
  });
});

describe("validatePlayPositions", () => {
  const petWidth = 72;
  const viewportWidth = 1920;
  const minSpacing = 50;
  const maxSpacing = 80;

  it("returns positions unchanged when spacing and bounds are valid", () => {
    // pet1 at x=400, pet2 at x=460. Center distance = 60 (>= max(72, 50) = 72? No, 60 < 72)
    // Actually let's pick positions where center distance is valid
    // pet1 at x=400, pet2 at x=475. Center distance = 75, effectiveMin = max(72,50) = 72. 72 <= 75 <= 80 ✓
    const result = validatePlayPositions(400, 475, petWidth, viewportWidth, minSpacing, maxSpacing);
    expect(result.cancelled).toBe(false);
    expect(result.pet1X).toBe(400);
    expect(result.pet2X).toBe(475);
  });

  it("enforces minimum spacing when pets are too close", () => {
    // pet1 at x=400, pet2 at x=420. Center distance = 20, effectiveMin = max(72,50) = 72
    // Midpoint = 410, leftX = 410 - 36 = 374, rightX = 410 + 36 = 446
    const result = validatePlayPositions(400, 420, petWidth, viewportWidth, minSpacing, maxSpacing);
    expect(result.cancelled).toBe(false);
    const centerDist = result.pet2X - result.pet1X;
    expect(centerDist).toBeGreaterThanOrEqual(Math.max(petWidth, minSpacing));
  });

  it("enforces maximum spacing when pets are too far apart", () => {
    // pet1 at x=100, pet2 at x=300. Center distance = 200, maxSpacing = 80
    // Midpoint = 200, leftX = 200 - 40 = 160, rightX = 200 + 40 = 240
    const result = validatePlayPositions(100, 300, petWidth, viewportWidth, minSpacing, maxSpacing);
    expect(result.cancelled).toBe(false);
    const centerDist = result.pet2X - result.pet1X;
    expect(centerDist).toBeLessThanOrEqual(maxSpacing);
  });

  it("shifts both pets inward when left pet is out of viewport bounds", () => {
    // pet1 at x=-20, pet2 at x=55. Center distance = 75, effectiveMin = 72.
    // leftX = -20 < 0, shift both right by 20
    const result = validatePlayPositions(-20, 55, petWidth, viewportWidth, minSpacing, maxSpacing);
    expect(result.cancelled).toBe(false);
    expect(result.pet1X).toBeGreaterThanOrEqual(0);
    expect(result.pet2X + petWidth).toBeLessThanOrEqual(viewportWidth);
    // Spacing preserved
    const centerDist = result.pet2X - result.pet1X;
    expect(centerDist).toBeGreaterThanOrEqual(Math.max(petWidth, minSpacing));
    expect(centerDist).toBeLessThanOrEqual(maxSpacing);
  });

  it("shifts both pets inward when right pet is out of viewport bounds", () => {
    // pet1 at x=1870, pet2 at x=1870 (same pos). After min spacing enforcement,
    // they'd be spread apart. Let's use positions that are valid but out of right bound.
    // pet1 at x=1840, pet2 at x=1916. Center distance = 76. effectiveMin = 72.
    // Right pet right edge = 1916 + 72 = 1988 > 1920. Shift left by 68.
    const result = validatePlayPositions(1840, 1916, petWidth, viewportWidth, minSpacing, maxSpacing);
    expect(result.cancelled).toBe(false);
    expect(result.pet2X + petWidth).toBeLessThanOrEqual(viewportWidth);
    expect(result.pet1X).toBeGreaterThanOrEqual(0);
  });

  it("preserves spacing distance when shifting for bounds correction", () => {
    // pet1 at x=-10, pet2 at x=65. Center distance = 75.
    const originalSpacing = 75; // rightX - leftX
    const result = validatePlayPositions(-10, 65, petWidth, viewportWidth, minSpacing, maxSpacing);
    expect(result.cancelled).toBe(false);
    const resultSpacing = result.pet2X - result.pet1X;
    expect(resultSpacing).toBe(originalSpacing);
  });

  it("cancels when viewport is too narrow for minimum spacing", () => {
    // effectiveMinSpacing = max(72, 50) = 72
    // Required total width = effectiveMinSpacing + petWidth = 72 + 72 = 144
    // viewport = 100 < 144 → cancelled
    const narrowViewport = 100;
    const result = validatePlayPositions(0, 50, petWidth, narrowViewport, minSpacing, maxSpacing);
    expect(result.cancelled).toBe(true);
  });

  it("cancels when viewport exactly equals required width minus 1", () => {
    // effectiveMinSpacing + petWidth = 72 + 72 = 144
    // viewport = 143 < 144 → cancelled
    const result = validatePlayPositions(0, 50, petWidth, 143, minSpacing, maxSpacing);
    expect(result.cancelled).toBe(true);
  });

  it("does not cancel when viewport exactly equals required width", () => {
    // effectiveMinSpacing + petWidth = 72 + 72 = 144
    // viewport = 144 → fits exactly
    const result = validatePlayPositions(0, 72, petWidth, 144, minSpacing, maxSpacing);
    expect(result.cancelled).toBe(false);
  });

  it("preserves pet order when pet1 is to the right of pet2", () => {
    // pet1 at x=500, pet2 at x=425. pet1 > pet2 → pet1 is on right side
    const result = validatePlayPositions(500, 425, petWidth, viewportWidth, minSpacing, maxSpacing);
    expect(result.cancelled).toBe(false);
    // pet1 should remain to the right of pet2
    expect(result.pet1X).toBeGreaterThan(result.pet2X);
  });

  it("uses petWidth as minimum spacing when petWidth > minSpacing", () => {
    // petWidth = 72 > minSpacing = 50, so effective min = 72
    // pet1 at x=400, pet2 at x=455. Center distance = 55. Less than 72.
    const result = validatePlayPositions(400, 455, petWidth, viewportWidth, minSpacing, maxSpacing);
    expect(result.cancelled).toBe(false);
    const centerDist = result.pet2X - result.pet1X;
    expect(centerDist).toBeGreaterThanOrEqual(petWidth);
  });

  it("uses minSpacing when minSpacing > petWidth", () => {
    // Small pet width where minSpacing dominates
    const smallPetWidth = 30;
    const result = validatePlayPositions(400, 420, smallPetWidth, viewportWidth, minSpacing, maxSpacing);
    expect(result.cancelled).toBe(false);
    const centerDist = result.pet2X - result.pet1X;
    expect(centerDist).toBeGreaterThanOrEqual(minSpacing);
  });
});
