// src/main/mediaPlaybackService.ts
// Main process service — polls media provider and sends state to renderer.

import type { MediaPlaybackState } from "../shared/media/mediaTypes";
import type { MediaProvider } from "./mediaProvider";

// ─── Configuration ───

export const MEDIA_POLL_INTERVAL_MS = 5000;

// ─── State ───

export interface MediaPlaybackServiceState {
  pollTimer: ReturnType<typeof setInterval> | null;
  provider: MediaProvider;
}

// ─── Lifecycle ───

export function createMediaPlaybackService(
  provider: MediaProvider,
  sendToRenderer: (state: MediaPlaybackState) => void,
): MediaPlaybackServiceState {
  const state: MediaPlaybackServiceState = {
    pollTimer: null,
    provider,
  };

  async function doPoll() {
    try {
      const playbackState = await state.provider.poll();
      if (playbackState.isPlaying) {
        console.log("[petmii:media] Detected playback:", playbackState.sourceApp, playbackState.title);
      }
      sendToRenderer(playbackState);
    } catch {
      // Provider error — produce safe fallback state
      const fallback: MediaPlaybackState = {
        isPlaying: false,
        detectedAt: Date.now(),
      };
      sendToRenderer(fallback);
    }
  }

  // Initial poll
  doPoll();

  // Start interval
  state.pollTimer = setInterval(doPoll, MEDIA_POLL_INTERVAL_MS);

  return state;
}

export function destroyMediaPlaybackService(state: MediaPlaybackServiceState): void {
  if (state.pollTimer !== null) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}
