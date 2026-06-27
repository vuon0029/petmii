import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isDanceTriggerMet,
  selectDanceCandidates,
  createDanceController,
  destroyDanceController,
  cancelDance,
  recoverStuckDance,
  onMediaStateUpdate,
  DANCE_COOLDOWN_MS,
  DANCE_CANCEL_COOLDOWN_MS,
  DANCE_DURATION_MS,
  DANCE_EVALUATION_INTERVAL_MS,
  DANCE_MAX_SIMULTANEOUS_STARTS,
} from "../danceController";
import type {
  DanceControllerState,
  DanceControllerDeps,
  DanceFeatureSettings,
  DancePetInfo,
} from "../danceController";
import type { MediaClassification } from "../../../shared/media/mediaTypes";

describe("isDanceTriggerMet", () => {
  const defaultSettings: DanceFeatureSettings = {
    danceToMusicEnabled: true,
    danceToBrowserAudioEnabled: true,
    simulateMusicPlaying: false,
  };

  const musicClassification: MediaClassification = {
    isPlaying: true,
    kind: "music",
    confidence: 0.85,
    reasonCodes: ["youtube_music_keyword"],
    sourceApp: "chrome",
  };

  it("returns false when danceToMusicEnabled is false", () => {
    const settings = { ...defaultSettings, danceToMusicEnabled: false };
    expect(isDanceTriggerMet(musicClassification, settings)).toBe(false);
  });

  it("returns true when simulateMusicPlaying is true even with null classification", () => {
    const settings = { ...defaultSettings, simulateMusicPlaying: true };
    expect(isDanceTriggerMet(null, settings)).toBe(true);
  });

  it("returns true when simulateMusicPlaying is true and classification is present", () => {
    const settings = { ...defaultSettings, simulateMusicPlaying: true };
    expect(isDanceTriggerMet(musicClassification, settings)).toBe(true);
  });

  it("returns false when simulateMusicPlaying is true but danceToMusicEnabled is false", () => {
    const settings = { ...defaultSettings, danceToMusicEnabled: false, simulateMusicPlaying: true };
    expect(isDanceTriggerMet(null, settings)).toBe(false);
  });

  it("returns false when classification is null and simulateMusicPlaying is false", () => {
    expect(isDanceTriggerMet(null, defaultSettings)).toBe(false);
  });

  it("returns false when danceToBrowserAudioEnabled is false and source is Chrome", () => {
    const settings = { ...defaultSettings, danceToBrowserAudioEnabled: false };
    expect(isDanceTriggerMet(musicClassification, settings)).toBe(false);
  });

  it("returns true when danceToBrowserAudioEnabled is false but source is Spotify", () => {
    const settings = { ...defaultSettings, danceToBrowserAudioEnabled: false };
    const spotifyClassification: MediaClassification = {
      ...musicClassification,
      sourceApp: "spotify",
    };
    expect(isDanceTriggerMet(spotifyClassification, settings)).toBe(true);
  });

  it("returns true when kind is music and confidence >= 0.7", () => {
    expect(isDanceTriggerMet(musicClassification, defaultSettings)).toBe(true);
  });

  it("returns false when kind is music but confidence < 0.7", () => {
    const lowConfidence: MediaClassification = {
      ...musicClassification,
      confidence: 0.5,
    };
    expect(isDanceTriggerMet(lowConfidence, defaultSettings)).toBe(false);
  });

  it("returns false when kind is video even with high confidence", () => {
    const videoClassification: MediaClassification = {
      ...musicClassification,
      kind: "video",
      confidence: 0.9,
    };
    expect(isDanceTriggerMet(videoClassification, defaultSettings)).toBe(false);
  });

  it("returns false when kind is unknown", () => {
    const unknownClassification: MediaClassification = {
      ...musicClassification,
      kind: "unknown",
      confidence: 0,
    };
    expect(isDanceTriggerMet(unknownClassification, defaultSettings)).toBe(false);
  });
});

describe("selectDanceCandidates", () => {
  it("returns all IDs when count <= maxStarts", () => {
    const ids = ["pet1", "pet2"];
    const result = selectDanceCandidates(ids, DANCE_MAX_SIMULTANEOUS_STARTS);
    expect(result).toHaveLength(2);
    expect(result.sort()).toEqual(["pet1", "pet2"]);
  });

  it("returns at most maxStarts IDs", () => {
    const ids = ["pet1", "pet2", "pet3", "pet4", "pet5"];
    const result = selectDanceCandidates(ids, DANCE_MAX_SIMULTANEOUS_STARTS);
    expect(result.length).toBeLessThanOrEqual(DANCE_MAX_SIMULTANEOUS_STARTS);
  });

  it("returns only IDs from the input set", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const result = selectDanceCandidates(ids, 2);
    for (const id of result) {
      expect(ids).toContain(id);
    }
  });

  it("returns empty array for empty input", () => {
    expect(selectDanceCandidates([], 2)).toEqual([]);
  });
});

describe("Dance Controller lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createMockDeps(overrides?: Partial<DanceControllerDeps>): DanceControllerDeps {
    return {
      getPets: () => [],
      getSettings: () => ({
        danceToMusicEnabled: true,
        danceToBrowserAudioEnabled: true,
        simulateMusicPlaying: true,
      }),
      hasPendingMovement: () => false,
      dispatchDance: vi.fn(),
      endDance: vi.fn(),
      ...overrides,
    };
  }

  function createHealthyPet(id: string): DancePetInfo {
    return {
      id,
      physicsState: "idle",
      currentAction: "idle",
      lifecycleState: "normal",
      isAlive: true,
      visualState: "idle",
      stats: { hunger: 80, happiness: 80, energy: 80, cleanliness: 80 },
    };
  }

  it("triggers dance after evaluation interval with simulateMusicPlaying", () => {
    const dispatchDance = vi.fn();
    const deps = createMockDeps({
      getPets: () => [createHealthyPet("pet1")],
      dispatchDance,
    });

    // Force trigger chance to always pass
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const state = createDanceController(deps);
    vi.advanceTimersByTime(DANCE_EVALUATION_INTERVAL_MS);

    expect(dispatchDance).toHaveBeenCalledWith("pet1", DANCE_DURATION_MS);
    destroyDanceController(state);
  });

  it("does NOT trigger dance when danceToMusicEnabled is false", () => {
    const dispatchDance = vi.fn();
    const deps = createMockDeps({
      getPets: () => [createHealthyPet("pet1")],
      getSettings: () => ({
        danceToMusicEnabled: false,
        danceToBrowserAudioEnabled: true,
        simulateMusicPlaying: true,
      }),
      dispatchDance,
    });

    const state = createDanceController(deps);
    vi.advanceTimersByTime(DANCE_EVALUATION_INTERVAL_MS * 3);

    expect(dispatchDance).not.toHaveBeenCalled();
    destroyDanceController(state);
  });

  it("records DANCE_COOLDOWN_MS on natural completion", () => {
    const dispatchDance = vi.fn();
    const endDance = vi.fn();
    const deps = createMockDeps({
      getPets: () => [createHealthyPet("pet1")],
      dispatchDance,
      endDance,
    });

    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const state = createDanceController(deps);
    vi.advanceTimersByTime(DANCE_EVALUATION_INTERVAL_MS);
    expect(dispatchDance).toHaveBeenCalled();

    // Advance past dance duration
    vi.advanceTimersByTime(DANCE_DURATION_MS);
    expect(endDance).toHaveBeenCalledWith("pet1", true);

    // Check cooldown is recorded
    const cooldown = state.cooldownExpiry.get("pet1");
    expect(cooldown).toBeDefined();

    destroyDanceController(state);
  });

  it("records DANCE_CANCEL_COOLDOWN_MS when dance is cancelled", () => {
    const dispatchDance = vi.fn();
    const endDance = vi.fn();
    const deps = createMockDeps({
      getPets: () => [createHealthyPet("pet1")],
      dispatchDance,
      endDance,
    });

    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const state = createDanceController(deps);
    vi.advanceTimersByTime(DANCE_EVALUATION_INTERVAL_MS);

    // Cancel the dance
    cancelDance(state, "pet1", deps, "drag");

    expect(endDance).toHaveBeenCalledWith("pet1", false);
    const cooldown = state.cooldownExpiry.get("pet1");
    expect(cooldown).toBeDefined();

    destroyDanceController(state);
  });

  it("cancelDance is idempotent — no-op if no active dance", () => {
    const endDance = vi.fn();
    const deps = createMockDeps({ endDance });
    const state = createDanceController(deps);

    cancelDance(state, "nonexistent", deps);
    expect(endDance).not.toHaveBeenCalled();

    destroyDanceController(state);
  });

  it("cancelDance with replacement does not force idle", () => {
    const dispatchDance = vi.fn();
    const endDance = vi.fn();
    const deps = createMockDeps({
      getPets: () => [createHealthyPet("pet1")],
      dispatchDance,
      endDance,
    });

    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const state = createDanceController(deps);
    vi.advanceTimersByTime(DANCE_EVALUATION_INTERVAL_MS);

    // Cancel with replacement "autonomousRest"
    cancelDance(state, "pet1", deps, "autonomousRest");
    expect(endDance).toHaveBeenCalledWith("pet1", false);

    destroyDanceController(state);
  });

  it("music stops mid-dance → dance continues to natural completion", () => {
    const dispatchDance = vi.fn();
    const endDance = vi.fn();
    const deps = createMockDeps({
      getPets: () => [createHealthyPet("pet1")],
      dispatchDance,
      endDance,
    });

    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const state = createDanceController(deps);
    vi.advanceTimersByTime(DANCE_EVALUATION_INTERVAL_MS);
    expect(dispatchDance).toHaveBeenCalled();

    // Music stops mid-dance (latestClassification goes null)
    state.latestClassification = null;

    // Dance timer should still fire after remaining duration
    vi.advanceTimersByTime(DANCE_DURATION_MS);
    expect(endDance).toHaveBeenCalledWith("pet1", true);

    destroyDanceController(state);
  });

  it("stuck-state recovery: pet with dance action but no timer → reset to idle", () => {
    const endDance = vi.fn();
    const deps = createMockDeps({ endDance });
    const state = createDanceController(deps);

    const pet = { currentAction: "dance", physicsState: "idle", lifecycleState: "normal" };
    recoverStuckDance(state, "stuckPet", pet, deps);

    expect(endDance).toHaveBeenCalledWith("stuckPet", false);

    destroyDanceController(state);
  });

  it("stuck-state recovery: pet with higher-priority state → only clears artifacts", () => {
    const endDance = vi.fn();
    const deps = createMockDeps({ endDance });
    const state = createDanceController(deps);

    const pet = { currentAction: "dance", physicsState: "drag", lifecycleState: "normal" };
    recoverStuckDance(state, "stuckPet", pet, deps);

    expect(endDance).toHaveBeenCalledWith("stuckPet", false);

    destroyDanceController(state);
  });

  it("does NOT mutate stats or careHistory (isolation check)", () => {
    const pet = createHealthyPet("pet1");
    const originalStats = { ...pet.stats };
    const dispatchDance = vi.fn();
    const endDance = vi.fn();

    const deps = createMockDeps({
      getPets: () => [pet],
      dispatchDance,
      endDance,
    });

    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const state = createDanceController(deps);
    vi.advanceTimersByTime(DANCE_EVALUATION_INTERVAL_MS);
    vi.advanceTimersByTime(DANCE_DURATION_MS);

    // Stats should be unchanged
    expect(pet.stats).toEqual(originalStats);

    destroyDanceController(state);
  });
});
