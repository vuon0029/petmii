// src/main/linuxMprisProvider.ts
// Linux MPRIS media session provider using playerctl CLI.
// Requires `playerctl` to be installed: sudo apt install playerctl
// Falls back gracefully if playerctl is unavailable.

import { execFile } from "child_process";
import { promisify } from "util";
import type { MediaPlaybackState } from "../shared/media/mediaTypes";
import type { MediaProvider } from "./mediaProvider";

const execFileAsync = promisify(execFile);

// playerctl format template — extracts all useful metadata in one call
const PLAYERCTL_FORMAT = "{{status}}\t{{playerName}}\t{{title}}\t{{artist}}\t{{mpris:length}}\t{{xesam:url}}";

/**
 * Linux MPRIS provider using playerctl.
 * Queries the currently active media player for metadata.
 * If playerctl is not installed or no player is active, returns isPlaying: false.
 */
export class LinuxMprisProvider implements MediaProvider {
  private playerctlAvailable: boolean | null = null;

  async poll(): Promise<MediaPlaybackState> {
    const now = Date.now();

    // Check availability on first call
    if (this.playerctlAvailable === null) {
      this.playerctlAvailable = await this.checkPlayerctl();
    }

    if (!this.playerctlAvailable) {
      return { isPlaying: false, detectedAt: now };
    }

    try {
      const { stdout } = await execFileAsync("playerctl", [
        "metadata",
        "--format", PLAYERCTL_FORMAT,
      ], { timeout: 3000 });

      return this.parseOutput(stdout.trim(), now);
    } catch {
      // playerctl returns exit code 1 when no player is active
      return { isPlaying: false, detectedAt: now };
    }
  }

  private async checkPlayerctl(): Promise<boolean> {
    try {
      await execFileAsync("playerctl", ["--version"], { timeout: 2000 });
      return true;
    } catch {
      console.warn("[petmii] playerctl not found — dance feature will use NoopMediaProvider. Install with: sudo apt install playerctl");
      return false;
    }
  }

  private parseOutput(output: string, now: number): MediaPlaybackState {
    if (!output) {
      return { isPlaying: false, detectedAt: now };
    }

    const parts = output.split("\t");
    const [status, playerName, title, artist, lengthStr, url] = parts;

    const isPlaying = status?.toLowerCase() === "playing";

    // Determine sourceApp from playerName
    // Common MPRIS player names: chromium, firefox, chrome, spotify, etc.
    const sourceApp = this.normalizePlayerName(playerName);

    // Parse duration (mpris:length is in microseconds)
    let durationMs: number | undefined;
    if (lengthStr && lengthStr !== "" && lengthStr !== "(null)") {
      const microseconds = parseInt(lengthStr, 10);
      if (!isNaN(microseconds) && microseconds > 0) {
        durationMs = Math.round(microseconds / 1000);
      }
    }

    const state: MediaPlaybackState = {
      isPlaying,
      detectedAt: now,
    };

    if (sourceApp) state.sourceApp = sourceApp;
    if (title && title !== "(null)" && title !== "") state.title = title;
    if (artist && artist !== "(null)" && artist !== "") state.artist = artist;
    if (url && url !== "(null)" && url !== "") state.url = url;
    if (durationMs !== undefined) state.durationMs = durationMs;

    // Use title as tabTitle for browser sources (browsers expose page title via MPRIS)
    if (sourceApp && this.isBrowserPlayer(sourceApp) && state.title) {
      state.tabTitle = state.title;
    }

    return state;
  }

  private normalizePlayerName(playerName: string | undefined): string | undefined {
    if (!playerName || playerName === "(null)") return undefined;
    const lower = playerName.toLowerCase();

    // Map common MPRIS player identifiers to browser names
    if (lower.includes("chromium") || lower.includes("chrome") || lower === "google-chrome") {
      return "chrome";
    }
    if (lower.includes("firefox")) {
      return "firefox";
    }
    if (lower.includes("edge") || lower === "microsoft-edge") {
      return "edge";
    }
    if (lower.includes("spotify")) {
      return "spotify";
    }

    return playerName;
  }

  private isBrowserPlayer(sourceApp: string): boolean {
    const lower = sourceApp.toLowerCase();
    return lower === "chrome" || lower === "firefox" || lower === "edge";
  }
}
