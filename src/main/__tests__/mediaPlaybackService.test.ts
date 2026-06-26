import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createMediaPlaybackService,
  destroyMediaPlaybackService,
  MEDIA_POLL_INTERVAL_MS,
} from "../mediaPlaybackService";
import { NoopMediaProvider } from "../mediaProvider";
import { MockMediaProvider } from "../mockMediaProvider";
import type { MediaPlaybackState } from "../../shared/media/mediaTypes";

describe("NoopMediaProvider", () => {
  it("returns isPlaying: false with a detectedAt timestamp", async () => {
    const provider = new NoopMediaProvider();
    const state = await provider.poll();
    expect(state.isPlaying).toBe(false);
    expect(state.detectedAt).toBeGreaterThan(0);
  });
});

describe("MockMediaProvider", () => {
  it("returns configured state", async () => {
    const custom: MediaPlaybackState = {
      isPlaying: true,
      sourceApp: "firefox",
      title: "Test Track",
      detectedAt: 12345,
    };
    const provider = new MockMediaProvider(custom);
    const state = await provider.poll();
    expect(state.isPlaying).toBe(true);
    expect(state.sourceApp).toBe("firefox");
    expect(state.title).toBe("Test Track");
    // detectedAt is updated on each poll
    expect(state.detectedAt).toBeGreaterThan(0);
  });

  it("browserMusicSample returns expected YouTube music-like state", () => {
    const sample = MockMediaProvider.browserMusicSample();
    expect(sample.isPlaying).toBe(true);
    expect(sample.sourceApp).toBe("chrome");
    expect(sample.title).toBe("Artist - Song official audio");
    expect(sample.url).toBe("https://www.youtube.com/watch?v=test");
    expect(sample.detectedAt).toBeGreaterThan(0);
  });

  it("setState updates the returned state", async () => {
    const provider = new MockMediaProvider();
    provider.setState({ isPlaying: false, detectedAt: 0 });
    const state = await provider.poll();
    expect(state.isPlaying).toBe(false);
  });
});

describe("createMediaPlaybackService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls sendToRenderer with valid state on initial poll", async () => {
    const sendToRenderer = vi.fn();
    const provider = new NoopMediaProvider();

    const state = createMediaPlaybackService(provider, sendToRenderer);

    // The initial poll is async — advance timer to flush microtasks
    await vi.advanceTimersByTimeAsync(10);

    expect(sendToRenderer).toHaveBeenCalled();
    const sentState = sendToRenderer.mock.calls[0][0];
    expect(sentState.isPlaying).toBe(false);
    expect(sentState.detectedAt).toBeGreaterThan(0);

    destroyMediaPlaybackService(state);
  });

  it("polls at MEDIA_POLL_INTERVAL_MS interval", async () => {
    const sendToRenderer = vi.fn();
    const provider = new MockMediaProvider();

    const state = createMediaPlaybackService(provider, sendToRenderer);
    await vi.advanceTimersByTimeAsync(10);
    sendToRenderer.mockClear();

    // Advance one full interval
    await vi.advanceTimersByTimeAsync(MEDIA_POLL_INTERVAL_MS);

    expect(sendToRenderer).toHaveBeenCalledTimes(1);

    destroyMediaPlaybackService(state);
  });

  it("catches provider errors and produces fallback state", async () => {
    const sendToRenderer = vi.fn();
    const provider = {
      poll: vi.fn().mockRejectedValue(new Error("API unavailable")),
    };

    const state = createMediaPlaybackService(provider, sendToRenderer);
    await vi.advanceTimersByTimeAsync(10);

    expect(sendToRenderer).toHaveBeenCalled();
    const sentState = sendToRenderer.mock.calls[0][0];
    expect(sentState.isPlaying).toBe(false);
    expect(sentState.detectedAt).toBeGreaterThan(0);

    destroyMediaPlaybackService(state);
  });

  it("destroyMediaPlaybackService stops polling", async () => {
    const sendToRenderer = vi.fn();
    const provider = new MockMediaProvider();

    const state = createMediaPlaybackService(provider, sendToRenderer);
    await vi.advanceTimersByTimeAsync(10);
    sendToRenderer.mockClear();

    destroyMediaPlaybackService(state);

    await vi.advanceTimersByTimeAsync(MEDIA_POLL_INTERVAL_MS * 5);

    expect(sendToRenderer).not.toHaveBeenCalled();
  });
});
