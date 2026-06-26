// src/main/windowsMediaProvider.ts
// Windows media session provider that works from WSL2.
// Uses powershell.exe to query the Windows Global System Media Transport Controls.
// Falls back gracefully if powershell is unavailable.

import { execFile } from "child_process";
import { promisify } from "util";
import type { MediaPlaybackState } from "../shared/media/mediaTypes";
import type { MediaProvider } from "./mediaProvider";

const execFileAsync = promisify(execFile);

// PowerShell script that queries Windows media session via GlobalSystemMediaTransportControlsSessionManager
const PS_SCRIPT = `
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
  $asyncOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
  $null = $asyncOp.AsTask().GetAwaiter().GetResult()
  $mgr = $asyncOp.GetResults()
  $session = $mgr.GetCurrentSession()
  if ($null -eq $session) { Write-Output "NO_SESSION"; exit 0 }
  $info = $session.TryGetMediaPropertiesAsync().AsTask().GetAwaiter().GetResult()
  $playback = $session.GetPlaybackInfo()
  $status = $playback.PlaybackStatus.ToString()
  $appId = $session.SourceAppUserModelId
  $title = if ($info.Title) { $info.Title } else { "" }
  $artist = if ($info.Artist) { $info.Artist } else { "" }
  Write-Output "$status`t$appId`t$title`t$artist"
} catch {
  Write-Output "ERROR"
}
`.trim();

/**
 * Windows media provider using PowerShell GlobalSystemMediaTransportControls.
 * Works from WSL2 by calling powershell.exe.
 */
export class WindowsMediaProvider implements MediaProvider {
  private available: boolean | null = null;

  async poll(): Promise<MediaPlaybackState> {
    const now = Date.now();

    if (this.available === null) {
      this.available = await this.checkAvailable();
    }

    if (!this.available) {
      return { isPlaying: false, detectedAt: now };
    }

    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", PS_SCRIPT],
        { timeout: 4000 },
      );

      return this.parseOutput(stdout.trim(), now);
    } catch {
      return { isPlaying: false, detectedAt: now };
    }
  }

  private async checkAvailable(): Promise<boolean> {
    try {
      await execFileAsync("powershell.exe", ["-NoProfile", "-Command", "echo ok"], { timeout: 3000 });
      return true;
    } catch {
      console.warn("[petmii] powershell.exe not available — Windows media detection disabled");
      return false;
    }
  }

  private parseOutput(output: string, now: number): MediaPlaybackState {
    if (!output || output === "NO_SESSION" || output === "ERROR") {
      return { isPlaying: false, detectedAt: now };
    }

    const parts = output.split("\t");
    const [status, appId, title, artist] = parts;

    const isPlaying = status?.toLowerCase() === "playing";
    const sourceApp = this.normalizeAppId(appId);

    const state: MediaPlaybackState = {
      isPlaying,
      detectedAt: now,
    };

    if (sourceApp) state.sourceApp = sourceApp;
    if (title) state.title = title;
    if (artist) state.artist = artist;

    // For browser sources, title is typically the tab/page title
    if (sourceApp && this.isBrowser(sourceApp) && title) {
      state.tabTitle = title;
    }

    return state;
  }

  private normalizeAppId(appId: string | undefined): string | undefined {
    if (!appId) return undefined;
    const lower = appId.toLowerCase();

    if (lower.includes("chrome")) return "chrome";
    if (lower.includes("firefox")) return "firefox";
    if (lower.includes("msedge") || lower.includes("edge")) return "edge";
    if (lower.includes("spotify")) return "spotify";

    return appId;
  }

  private isBrowser(sourceApp: string): boolean {
    const lower = sourceApp.toLowerCase();
    return lower === "chrome" || lower === "firefox" || lower === "edge";
  }
}
