// src/shared/media/mediaTypes.ts
// Canonical location for media-related types shared across main, shared, and renderer layers.

export interface MediaPlaybackState {
  isPlaying: boolean;
  sourceApp?: string; // e.g. "chrome", "firefox", "edge", "spotify"
  title?: string; // media title from session
  artist?: string; // artist metadata if available
  url?: string; // URL if detectable (often absent without browser extension)
  tabTitle?: string; // browser tab title if available via heuristics
  isAudible?: boolean; // whether audio is currently audible (often absent)
  durationMs?: number; // track duration in milliseconds
  detectedAt: number; // Date.now() timestamp of detection
}

export interface MediaClassification {
  isPlaying: boolean;
  kind: "music" | "video" | "unknown";
  confidence: number; // 0–1
  reasonCodes: string[]; // e.g. ["youtube_music_keyword", "artist_dash_title"]
  sourceApp?: string;
  title?: string;
  artist?: string;
  url?: string;
  tabTitle?: string;
  durationMs?: number;
}
