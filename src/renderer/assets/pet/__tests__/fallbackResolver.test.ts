import { describe, it, expect } from "vitest";
import {
  resolveSprite,
  SpriteRegistry,
} from "../fallbackResolver";
import { DEFAULT_SPRITE_METADATA } from "../spriteMetadata";

/**
 * Helper to build a minimal registry for testing.
 */
function buildRegistry(
  entries: Array<{
    species: string;
    variantId: string;
    lifeStage: string;
    visualState: string;
    src: string;
    metadata?: Record<string, unknown>;
  }>
): SpriteRegistry {
  const registry: SpriteRegistry = {};
  for (const entry of entries) {
    if (!registry[entry.species]) registry[entry.species] = {};
    if (!registry[entry.species][entry.variantId])
      registry[entry.species][entry.variantId] = {};
    if (!registry[entry.species][entry.variantId][entry.lifeStage])
      registry[entry.species][entry.variantId][entry.lifeStage] = {};
    registry[entry.species][entry.variantId][entry.lifeStage][
      entry.visualState
    ] = {
      src: entry.src,
      metadata: entry.metadata as any,
    };
  }
  return registry;
}

describe("fallbackResolver - resolveSprite", () => {
  it("Step 1: returns exact match when species/variantId/lifeStage/visualState exists", () => {
    const registry = buildRegistry([
      {
        species: "frog",
        variantId: "yellow",
        lifeStage: "baby",
        visualState: "sleep",
        src: "assets/pet/frog/yellow/baby_sleep.png",
      },
    ]);

    const result = resolveSprite("frog", "yellow", "baby", "sleep", registry);
    expect(result).not.toBeNull();
    expect(result!.src).toBe("assets/pet/frog/yellow/baby_sleep.png");
    expect(result!.metadata).toEqual(DEFAULT_SPRITE_METADATA);
  });

  it("Step 2: falls back to idle when sleep sprite is missing", () => {
    const registry = buildRegistry([
      {
        species: "frog",
        variantId: "yellow",
        lifeStage: "baby",
        visualState: "idle",
        src: "assets/pet/frog/yellow/baby.png",
      },
    ]);

    const result = resolveSprite("frog", "yellow", "baby", "sleep", registry);
    expect(result).not.toBeNull();
    expect(result!.src).toBe("assets/pet/frog/yellow/baby.png");
  });

  it("Step 2: does not re-check idle when already requesting idle (proceeds to step 3)", () => {
    // If requesting idle and it's not found, should skip step 2 and go to step 3
    const registry = buildRegistry([
      {
        species: "frog",
        variantId: "blue",
        lifeStage: "baby",
        visualState: "idle",
        src: "assets/pet/frog/blue/baby.png",
      },
    ]);

    // "blue" is the first variant (default), requesting "yellow" which doesn't exist
    const result = resolveSprite("frog", "yellow", "baby", "idle", registry);
    // Step 1 fails (no frog/yellow/baby/idle), step 2 is skipped (already idle),
    // step 3 tries default variant "blue" — should find it
    expect(result).not.toBeNull();
    expect(result!.src).toBe("assets/pet/frog/blue/baby.png");
  });

  it("Step 3: falls back to default variant when variantId not found", () => {
    const registry = buildRegistry([
      {
        species: "frog",
        variantId: "yellow",
        lifeStage: "child",
        visualState: "idle",
        src: "assets/pet/frog/yellow/child.png",
      },
    ]);

    // "yellow" is the default (first registered variant), "unknown_variant" doesn't exist
    const result = resolveSprite(
      "frog",
      "unknown_variant",
      "child",
      "sleep",
      registry
    );
    expect(result).not.toBeNull();
    expect(result!.src).toBe("assets/pet/frog/yellow/child.png");
  });

  it("Step 3: skips default variant fallback when variantId IS the default variant", () => {
    // When the requested variantId is already the default, step 3 is skipped
    const registry = buildRegistry([
      {
        species: "frog",
        variantId: "yellow",
        lifeStage: "adult",
        visualState: "idle",
        src: "assets/pet/frog/yellow/adult.png",
      },
    ]);

    // Request "yellow" (which IS the default) with "baby" lifeStage — not found
    // Step 1: frog/yellow/baby/idle — not found
    // Step 2: skipped (already idle)
    // Step 3: skipped (yellow IS the default variant)
    // Step 4: frog/yellow/adult/idle — found!
    const result = resolveSprite("frog", "yellow", "baby", "idle", registry);
    expect(result).not.toBeNull();
    expect(result!.src).toBe("assets/pet/frog/yellow/adult.png");
  });

  it("Step 4: falls back to adult lifeStage when baby/child not found", () => {
    const registry = buildRegistry([
      {
        species: "blob",
        variantId: "pink",
        lifeStage: "adult",
        visualState: "idle",
        src: "assets/pet/blob/pink/adult.png",
      },
    ]);

    const result = resolveSprite("blob", "pink", "child", "sleep", registry);
    expect(result).not.toBeNull();
    expect(result!.src).toBe("assets/pet/blob/pink/adult.png");
  });

  it("Step 4: skips adult fallback when lifeStage is already adult", () => {
    // If lifeStage is already "adult" and not found, go directly to null
    const registry = buildRegistry([
      {
        species: "blob",
        variantId: "blue",
        lifeStage: "baby",
        visualState: "idle",
        src: "assets/pet/blob/blue/baby.png",
      },
    ]);

    // Request blob/pink/adult/idle — not found anywhere
    // Step 1: blob/pink/adult/idle — not found
    // Step 2: skipped (already idle)
    // Step 3: default variant is "blue" → blob/blue/adult/idle — not found
    // Step 4: skipped (already adult)
    // Step 5: null
    const result = resolveSprite("blob", "pink", "adult", "idle", registry);
    expect(result).toBeNull();
  });

  it("Step 5: returns null (CSS fallback) when no sprite found anywhere", () => {
    const registry: SpriteRegistry = {};
    const result = resolveSprite("unknown", "variant", "baby", "idle", registry);
    expect(result).toBeNull();
  });

  it("returns validated metadata when sprite entry has custom metadata", () => {
    const registry = buildRegistry([
      {
        species: "frog",
        variantId: "yellow",
        lifeStage: "adult",
        visualState: "idle",
        src: "assets/pet/frog/yellow/adult.png",
        metadata: { frameCount: 8, durationMs: 2000 },
      },
    ]);

    const result = resolveSprite("frog", "yellow", "adult", "idle", registry);
    expect(result).not.toBeNull();
    expect(result!.metadata.frameCount).toBe(8);
    expect(result!.metadata.durationMs).toBe(2000);
    // Defaults for missing fields
    expect(result!.metadata.frameSize).toBe(48);
    expect(result!.metadata.loop).toBe(true);
  });

  it("clamps out-of-range metadata values", () => {
    const registry = buildRegistry([
      {
        species: "blob",
        variantId: "blue",
        lifeStage: "baby",
        visualState: "idle",
        src: "assets/pet/blob/blue/baby.png",
        metadata: { frameSize: 500, frameCount: 0, durationMs: -10 },
      },
    ]);

    const result = resolveSprite("blob", "blue", "baby", "idle", registry);
    expect(result).not.toBeNull();
    expect(result!.metadata.frameSize).toBe(256); // clamped max
    expect(result!.metadata.frameCount).toBe(1); // clamped min
    expect(result!.metadata.durationMs).toBe(100); // clamped min
  });

  it("respects the first registered variant as default variant", () => {
    const registry = buildRegistry([
      {
        species: "frog",
        variantId: "blue",
        lifeStage: "baby",
        visualState: "idle",
        src: "assets/pet/frog/blue/baby.png",
      },
      {
        species: "frog",
        variantId: "yellow",
        lifeStage: "baby",
        visualState: "idle",
        src: "assets/pet/frog/yellow/baby.png",
      },
    ]);

    // Request a non-existent variant — should fall back to "blue" (first registered)
    const result = resolveSprite("frog", "pink", "baby", "idle", registry);
    expect(result).not.toBeNull();
    expect(result!.src).toBe("assets/pet/frog/blue/baby.png");
  });

  it("returns idle sprite directly at step 1 when visualState is idle", () => {
    const registry = buildRegistry([
      {
        species: "blob",
        variantId: "yellow",
        lifeStage: "adult",
        visualState: "idle",
        src: "assets/pet/blob/yellow/adult.png",
      },
    ]);

    const result = resolveSprite("blob", "yellow", "adult", "idle", registry);
    expect(result).not.toBeNull();
    expect(result!.src).toBe("assets/pet/blob/yellow/adult.png");
  });
});
