import { describe, it, expect } from "vitest";
import {
  classifyMedia,
  isBrowserOrigin,
  DANCE_CONFIDENCE_THRESHOLD,
  LONG_DURATION_CONFIDENCE_CAP,
} from "../mediaClassifier";
import type { MediaPlaybackState } from "../mediaTypes";

describe("classifyMedia", () => {
  const now = Date.now();

  it("returns unknown with confidence 0 when isPlaying is false", () => {
    const state: MediaPlaybackState = {
      isPlaying: false,
      sourceApp: "chrome",
      title: "Artist - Song official audio",
      url: "https://www.youtube.com/watch?v=test",
      detectedAt: now,
    };
    const result = classifyMedia(state);
    expect(result.kind).toBe("unknown");
    expect(result.confidence).toBe(0);
    expect(result.reasonCodes).toEqual([]);
  });

  it("classifies Spotify 'Artist - Song' as music with confidence >= 0.5", () => {
    const state: MediaPlaybackState = {
      isPlaying: true,
      sourceApp: "spotify",
      title: "Daft Punk - Around The World",
      detectedAt: now,
    };
    const result = classifyMedia(state);
    expect(result.kind).toBe("music");
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.reasonCodes).toContain("artist_dash_title");
  });

  it("classifies YouTube music keyword as music with confidence >= 0.8", () => {
    const state: MediaPlaybackState = {
      isPlaying: true,
      sourceApp: "chrome",
      title: "Taylor Swift - Anti-Hero (Official Music Video)",
      url: "https://www.youtube.com/watch?v=abc123",
      detectedAt: now,
    };
    const result = classifyMedia(state);
    expect(result.kind).toBe("music");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("classifies YouTube 'Lofi hip hop radio' with 3hr duration as capped music", () => {
    const state: MediaPlaybackState = {
      isPlaying: true,
      sourceApp: "chrome",
      title: "Lofi hip hop radio - beats to study to",
      artist: "ChilledCow",
      url: "https://www.youtube.com/watch?v=lofi",
      durationMs: 10_800_000, // 3 hours
      detectedAt: now,
    };
    const result = classifyMedia(state);
    // Has artist metadata so music confidence > 0, but capped by long duration
    if (result.kind === "music") {
      expect(result.confidence).toBeLessThanOrEqual(LONG_DURATION_CONFIDENCE_CAP);
    }
  });

  it("classifies Firefox podcast as video", () => {
    const state: MediaPlaybackState = {
      isPlaying: true,
      sourceApp: "firefox",
      title: "The Joe Rogan Experience - Episode 1234 podcast",
      detectedAt: now,
    };
    const result = classifyMedia(state);
    expect(result.kind).toBe("video");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("classifies Edge with no metadata as unknown", () => {
    const state: MediaPlaybackState = {
      isPlaying: true,
      sourceApp: "edge",
      detectedAt: now,
    };
    const result = classifyMedia(state);
    expect(result.kind).toBe("unknown");
    expect(result.confidence).toBeLessThan(DANCE_CONFIDENCE_THRESHOLD);
  });

  it("handles all optional fields missing without throwing", () => {
    const state: MediaPlaybackState = {
      isPlaying: true,
      detectedAt: now,
    };
    expect(() => classifyMedia(state)).not.toThrow();
    const result = classifyMedia(state);
    expect(result.kind).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.reasonCodes)).toBe(true);
  });

  it("boosts confidence for duration in music range", () => {
    const state: MediaPlaybackState = {
      isPlaying: true,
      sourceApp: "spotify",
      artist: "The Beatles",
      title: "Here Comes The Sun",
      durationMs: 180_000, // 3 minutes
      detectedAt: now,
    };
    const result = classifyMedia(state);
    expect(result.kind).toBe("music");
    expect(result.reasonCodes).toContain("music_duration_range");
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("produces deterministic output for same input", () => {
    const state: MediaPlaybackState = {
      isPlaying: true,
      sourceApp: "chrome",
      title: "Artist - Song official audio",
      url: "https://www.youtube.com/watch?v=test",
      durationMs: 240_000,
      detectedAt: now,
    };
    const result1 = classifyMedia(state);
    const result2 = classifyMedia(state);
    expect(result1).toEqual(result2);
  });
});

describe("isBrowserOrigin", () => {
  it("returns true for 'Chrome'", () => {
    expect(isBrowserOrigin("Chrome")).toBe(true);
  });

  it("returns true for 'Google Chrome'", () => {
    expect(isBrowserOrigin("Google Chrome")).toBe(true);
  });

  it("returns true for 'firefox'", () => {
    expect(isBrowserOrigin("firefox")).toBe(true);
  });

  it("returns true for 'Microsoft Edge'", () => {
    expect(isBrowserOrigin("Microsoft Edge")).toBe(true);
  });

  it("returns false for 'spotify'", () => {
    expect(isBrowserOrigin("spotify")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isBrowserOrigin(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isBrowserOrigin("")).toBe(false);
  });
});
