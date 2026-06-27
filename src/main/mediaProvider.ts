// src/main/mediaProvider.ts
// Adapter interface for platform-dependent media session detection.

import type { MediaPlaybackState } from "../shared/media/mediaTypes";

export interface MediaProvider {
  poll(): Promise<MediaPlaybackState>;
}

/**
 * Fallback provider that always reports no playback.
 * Guarantees the feature operates safely when no platform-specific provider is available.
 */
export class NoopMediaProvider implements MediaProvider {
  async poll(): Promise<MediaPlaybackState> {
    return { isPlaying: false, detectedAt: Date.now() };
  }
}
