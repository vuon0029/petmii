// src/main/mockMediaProvider.ts
// Debug/test media provider with configurable state.

import type { MediaPlaybackState } from "../shared/media/mediaTypes";
import type { MediaProvider } from "./mediaProvider";

/**
 * Configurable media provider for tests and local development.
 * Returns whatever MediaPlaybackState is configured via constructor or setter.
 */
export class MockMediaProvider implements MediaProvider {
  private state: MediaPlaybackState;

  constructor(initialState?: MediaPlaybackState) {
    this.state = initialState ?? MockMediaProvider.browserMusicSample();
  }

  /** Returns a pre-built YouTube music-like state useful for testing dance triggers */
  static browserMusicSample(): MediaPlaybackState {
    return {
      isPlaying: true,
      sourceApp: "chrome",
      title: "Artist - Song official audio",
      url: "https://www.youtube.com/watch?v=test",
      detectedAt: Date.now(),
    };
  }

  setState(state: MediaPlaybackState): void {
    this.state = state;
  }

  async poll(): Promise<MediaPlaybackState> {
    // Update detectedAt to current time on each poll
    return { ...this.state, detectedAt: Date.now() };
  }
}
