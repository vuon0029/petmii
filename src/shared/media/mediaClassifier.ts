// src/shared/media/mediaClassifier.ts
// Pure function classifier — zero I/O, deterministic, no side effects.

import type { MediaPlaybackState, MediaClassification } from "./mediaTypes";

// ─── Constants ───

export const DANCE_CONFIDENCE_THRESHOLD = 0.7;

export const MUSIC_KEYWORDS = [
  "official audio",
  "official music video",
  "official video",
  "music video",
  "lyrics",
  "lyric video",
  "visualizer",
  "audio",
  "mv",
  "live session",
  "performance video",
  "official mv",
  "full album",
  "playlist",
  "mix",
  "lofi",
  "lo-fi",
  "chill",
  "beats",
];

export const VIDEO_KEYWORDS = [
  "podcast",
  "interview",
  "tutorial",
  "review",
  "reaction",
  "vlog",
  "documentary",
  "episode",
  "news",
  "stream",
  "gameplay",
];

export const SUPPORTED_BROWSERS = ["chrome", "edge", "firefox"];

export const MUSIC_DURATION_MIN_MS = 60_000; // 1 minute
export const MUSIC_DURATION_MAX_MS = 720_000; // 12 minutes
export const VIDEO_DURATION_THRESHOLD_MS = 1_200_000; // 20 minutes
export const LONG_DURATION_CONFIDENCE_CAP = 0.4;

// ─── Helpers ───

/** Detects Chrome, Edge, and Firefox source apps using case-insensitive matching */
export function isBrowserOrigin(sourceApp?: string): boolean {
  if (!sourceApp) return false;
  const lower = sourceApp.toLowerCase();
  return SUPPORTED_BROWSERS.some((b) => lower.includes(b));
}

function containsKeyword(text: string | undefined, keywords: readonly string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function hasArtistDashTitle(title: string | undefined): boolean {
  if (!title) return false;
  // Match patterns like "Artist - Song Title" or "Artist — Song"
  return /\s[-–—]\s/.test(title);
}

// ─── Pure classifier ───

export function classifyMedia(state: MediaPlaybackState): MediaClassification {
  const base = {
    isPlaying: state.isPlaying,
    sourceApp: state.sourceApp,
    title: state.title,
    artist: state.artist,
    url: state.url,
    tabTitle: state.tabTitle,
    durationMs: state.durationMs,
  };

  // Rule 1: Not playing → unknown
  if (!state.isPlaying) {
    return { ...base, kind: "unknown", confidence: 0, reasonCodes: [] };
  }

  const reasonCodes: string[] = [];
  let musicConfidence = 0;

  // Rule 2: Check video-negative keywords in title/tabTitle
  const titleHasVideo = containsKeyword(state.title, VIDEO_KEYWORDS);
  const tabTitleHasVideo = containsKeyword(state.tabTitle, VIDEO_KEYWORDS);
  if (titleHasVideo || tabTitleHasVideo) {
    reasonCodes.push("video_keyword");
    return { ...base, kind: "video", confidence: 0.85, reasonCodes };
  }

  // Rule 3: YouTube/music platform + music keywords → high confidence
  const isBrowser = isBrowserOrigin(state.sourceApp);
  const hasYoutubeUrl =
    state.url?.toLowerCase().includes("youtube.com/watch") ?? false;
  const hasYoutubeInTitle =
    (state.title?.toLowerCase().includes("youtube") ?? false) ||
    (state.tabTitle?.toLowerCase().includes("youtube") ?? false);
  const hasMusicPlatformInTitle =
    containsKeyword(state.title, ["spotify", "soundcloud", "deezer", "apple music", "bandcamp"]) ||
    containsKeyword(state.tabTitle, ["spotify", "soundcloud", "deezer", "apple music", "bandcamp"]);

  const titleHasMusic = containsKeyword(state.title, MUSIC_KEYWORDS);
  const tabTitleHasMusic = containsKeyword(state.tabTitle, MUSIC_KEYWORDS);

  // YouTube + explicit music keywords → high confidence
  if (isBrowser && (hasYoutubeUrl || hasYoutubeInTitle) && (titleHasMusic || tabTitleHasMusic)) {
    reasonCodes.push("youtube_music_keyword");
    musicConfidence = 0.85;
  }

  // Dedicated music streaming platforms in browser → high confidence
  if (isBrowser && hasMusicPlatformInTitle) {
    reasonCodes.push("music_platform");
    musicConfidence = Math.max(musicConfidence, 0.8);
  }

  // NOTE: YouTube open by default (without music keywords or artist pattern) does NOT trigger dance.
  // The classifier requires explicit music signals to reach the 0.7 threshold.

  // Rule 4: "Artist - Song" pattern or artist metadata
  if (hasArtistDashTitle(state.title)) {
    reasonCodes.push("artist_dash_title");
    // If it's YouTube + artist-dash-title, that's very likely music
    if (hasYoutubeInTitle || hasYoutubeUrl) {
      musicConfidence = Math.max(musicConfidence, 0.8);
    } else {
      musicConfidence = Math.max(musicConfidence, 0.55);
    }
  }
  if (state.artist) {
    reasonCodes.push("artist_metadata");
    musicConfidence = Math.max(musicConfidence, 0.55);
  }

  // Rule 5: Duration in music range → boost
  if (
    state.durationMs !== undefined &&
    state.durationMs >= MUSIC_DURATION_MIN_MS &&
    state.durationMs <= MUSIC_DURATION_MAX_MS
  ) {
    reasonCodes.push("music_duration_range");
    musicConfidence = Math.min(1, musicConfidence + 0.15);
  }

  // Rule 6: Duration > 20 min → cap music confidence
  if (
    state.durationMs !== undefined &&
    state.durationMs > VIDEO_DURATION_THRESHOLD_MS
  ) {
    reasonCodes.push("long_duration_cap");
    musicConfidence = Math.min(musicConfidence, LONG_DURATION_CONFIDENCE_CAP);
  }

  // Determine final classification
  if (musicConfidence >= DANCE_CONFIDENCE_THRESHOLD) {
    return { ...base, kind: "music", confidence: musicConfidence, reasonCodes };
  }

  if (musicConfidence > 0) {
    // Some music signals but not enough confidence
    return { ...base, kind: "music", confidence: musicConfidence, reasonCodes };
  }

  // No strong signals → unknown below threshold
  return { ...base, kind: "unknown", confidence: 0, reasonCodes };
}
