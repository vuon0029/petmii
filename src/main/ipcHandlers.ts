// src/main/ipcHandlers.ts
// Registers IPC handlers bridging renderer to storage and window management.

import { app, ipcMain, BrowserWindow, screen } from "electron";
import {
  loadGameState,
  saveGameState,
  savePetState,
  clearPetState,
  addPet,
  removePet,
  removeEgg,
  setOverlayPets,
  getOverlayPets,
} from "./petStorage";
import type { GameState, Egg } from "./petStorage";
import type { PetState } from "../renderer/pet/petVariant";
import {
  closeOverlayWindow,
  getOverlayWindow,
  showOverlay,
  hideOverlay,
  getMainWindow,
  restoreMainWindow,
  isOverlayVisible,
} from "./windowManager";
import { registerCareIncrementHandler } from "./careIncrementHandler";
import { registerEvolutionHandlers } from "./evolutionHandler";
import { createMediaPlaybackService, destroyMediaPlaybackService, MediaPlaybackServiceState } from "./mediaPlaybackService";
import { NoopMediaProvider } from "./mediaProvider";
import { LinuxMprisProvider } from "./linuxMprisProvider";
import type { MediaProvider } from "./mediaProvider";
import type { MediaPlaybackState } from "../shared/media/mediaTypes";
import { execFileSync, execFile } from "child_process";
import { promisify } from "util";
import {
  isPetBusy,
  setAutonomousAction,
  clearAutonomousAction,
  getAutonomousActionInfo,
  setResting,
  clearResting,
  setUserActionInProgress,
  clearUserActionInProgress,
  autonomousActionPetIds,
  restingPetIds,
} from "./runtimePetState";
import { getPetActionAvailability, applyUserAction } from "./actionValidator";
import { applyAutonomousRestBenefits, applyPlayTogetherBenefits } from "./autonomousBenefits";
import type { UserActionType } from "../shared/pet/actionTypes";

export function registerIpcHandlers(): void {
  // ===== Game State =====

  ipcMain.handle("game:load", () => {
    const game = loadGameState();
    console.log("[petmii] IPC game:load →", `${game.pets.length} pets, ${game.eggs.length} eggs`);
    return game;
  });

  ipcMain.handle("game:save", (_, state: GameState) => {
    const result = saveGameState(state);
    console.log("[petmii] IPC game:save →", result ? "success" : "FAILED");
    return result;
  });

  // ===== Pet Operations =====

  ipcMain.handle("pet:load", () => {
    const game = loadGameState();
    return game.pets;
  });

  ipcMain.handle("pet:save", (_, state: PetState) => {
    const result = savePetState(state);
    console.log("[petmii] IPC pet:save →", result ? "success" : "FAILED", state?.name);
    if (result) {
      // Broadcast updated game state to all windows (including overlay)
      const game = loadGameState();
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send("game:state-update", game);
        }
      }
    }
    return result;
  });

  ipcMain.handle("pet:add", (_, state: PetState) => {
    const result = addPet(state);
    console.log("[petmii] IPC pet:add →", result ? "success" : "FAILED (max reached?)", state?.name);
    if (result) {
      const game = loadGameState();
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send("game:state-update", game);
        }
      }
    }
    return result;
  });

  ipcMain.handle("pet:remove", (_, petId: string) => {
    const result = removePet(petId);
    console.log("[petmii] IPC pet:remove →", result ? "success" : "FAILED", petId);
    if (result) {
      const game = loadGameState();
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send("game:state-update", game);
        }
      }
    }
    return result;
  });

  ipcMain.handle("pet:clear", () => {
    const result = clearPetState();
    console.log("[petmii] IPC pet:clear →", result ? "cleared" : "FAILED");
    return result;
  });

  // ===== Egg Operations =====

  ipcMain.handle("egg:hatch", (_, eggId: string) => {
    const egg = removeEgg(eggId);
    console.log("[petmii] IPC egg:hatch →", egg ? `${egg.species} egg` : "not found");
    return egg;
  });

  // ===== Overlay Settings =====

  ipcMain.handle("overlay:get-pets", () => {
    return getOverlayPets();
  });

  ipcMain.handle("overlay:is-visible", () => {
    return isOverlayVisible();
  });

  ipcMain.handle("overlay:set-pets", (_, petIds: string[]) => {
    return setOverlayPets(petIds);
  });

  // ===== Window Management =====

  ipcMain.on("window:close-overlay", () => closeOverlayWindow());
  ipcMain.on("window:show-overlay", () => showOverlay());
  ipcMain.on("window:hide-overlay", () => hideOverlay());

  ipcMain.on("window:enter-overlay-mode", () => {
    console.log("[petmii] IPC: toggle-overlay received, current:", isOverlayVisible());
    if (isOverlayVisible()) {
      hideOverlay();
    } else {
      showOverlay();
    }
  });

  // Mouse event toggling for overlay (full-screen click-through)
  ipcMain.on("overlay:set-interactive", (_, interactive: boolean) => {
    const overlay = getOverlayWindow();
    if (overlay && !overlay.isDestroyed()) {
      if (interactive) {
        overlay.setIgnoreMouseEvents(false);
      } else {
        overlay.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  });

  ipcMain.on("window:exit-overlay-mode", () => {
    // Clicking a pet in overlay — restore main window focus but keep overlay
    restoreMainWindow();
  });

  ipcMain.on("window:update-overlay", (_, variant) => {
    const overlay = getOverlayWindow();
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send("pet:variant-update", variant);
    }
  });

  ipcMain.on("window:update-overlay-state", (_, petState) => {
    const overlay = getOverlayWindow();
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send("pet:state-update", petState);
    }
  });

  // ===== System =====

  ipcMain.handle("get-cursor-position", () => {
    const point = screen.getCursorScreenPoint();
    return { x: point.x, y: point.y };
  });

  ipcMain.handle("system:get-metrics", () => {
    const metrics = app.getAppMetrics();
    const mainMemory = process.memoryUsage();
    return {
      processes: metrics.map((m) => ({
        pid: m.pid,
        type: m.type,
        name: m.name || m.type,
        cpu: {
          percentCPUUsage: m.cpu.percentCPUUsage,
        },
        memory: {
          workingSetSize: m.memory.workingSetSize,
          peakWorkingSetSize: m.memory.peakWorkingSetSize,
        },
      })),
      mainProcess: {
        rss: mainMemory.rss,
        heapUsed: mainMemory.heapUsed,
        heapTotal: mainMemory.heapTotal,
        external: mainMemory.external,
      },
    };
  });

  // ===== REST Action =====

  ipcMain.on("pet:rest-start", (_, data: { petId: string }) => {
    setResting(data.petId);
    const overlay = getOverlayWindow();
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send("overlay:rest-command", data);
    }
  });

  ipcMain.on("pet:rest-ended", (_, data: { petId: string; completed: boolean }) => {
    clearResting(data.petId);
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send("pet:rest-ended", data);
    }
  });

  ipcMain.handle("pet:is-resting", (_, petId: string) => {
    return restingPetIds.has(petId);
  });

  // ===== Egg Notification Clearing =====
  ipcMain.on("egg:clear-notifications", () => {
    const overlay = getOverlayWindow();
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send("egg:clear-notifications");
    }
  });

  // ===== Autonomous Actions =====

  ipcMain.on("pet:autonomous-action-started", (_, data: { petId: string; action: string; durationMs?: number }) => {
    const endTime = data.durationMs ? Date.now() + data.durationMs : Date.now() + 45000;
    setAutonomousAction(data.petId, data.action, endTime);
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send("pet:autonomous-action-started", data);
    }
  });

  ipcMain.on("pet:autonomous-action-ended", (_, data: { petId: string; action: string; completed?: boolean }) => {
    clearAutonomousAction(data.petId);

    // Apply benefits only if the action completed (not interrupted).
    // Default to true for backwards compatibility.
    if (data.completed !== false) {
      const game = loadGameState();
      const pet = game.pets.find(p => p.id === data.petId);
      if (pet) {
        if (data.action === 'autonomousRest') {
          applyAutonomousRestBenefits(pet);
        } else if (data.action === 'playTogether') {
          applyPlayTogetherBenefits(pet);
        }
        saveGameState(game);

        // Broadcast updated game state to all windows
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send("game:state-update", game);
          }
        }
      }
    }

    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send("pet:autonomous-action-ended", data);
    }
  });

  ipcMain.handle("pet:is-autonomous-action-active", (_, petId: string) => {
    return autonomousActionPetIds.has(petId);
  });

  ipcMain.handle("pet:get-autonomous-action-info", (_, petId: string) => {
    const info = getAutonomousActionInfo(petId);
    if (!info) return null;
    const remainingMs = Math.max(0, info.endTime - Date.now());
    return { action: info.action, remainingMs };
  });

  // ===== Pet Action (User-Triggered with Cooldown Validation) =====

  ipcMain.handle("pet:action", async (_, payload: { petId: string; action: string }) => {
    const { petId, action } = payload;

    // Validate action type
    const validActions: UserActionType[] = ['feed', 'play', 'rest', 'clean'];
    if (!validActions.includes(action as UserActionType)) {
      return { available: false, message: 'Invalid action type' };
    }

    // Load state
    const game = loadGameState();
    const pet = game.pets.find(p => p.id === petId);
    if (!pet) {
      return { available: false, message: 'Pet not found' };
    }

    // Check availability (pure)
    const isBusy = isPetBusy(petId);
    const availability = getPetActionAvailability(pet, action as UserActionType, isBusy);

    if (!availability.available) {
      return availability;
    }

    // Apply effects with userActionInProgress safety
    try {
      setUserActionInProgress(petId);
      applyUserAction(pet, action as UserActionType);
      saveGameState(game);

      // Broadcast game:state-update to all windows
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send("game:state-update", game);
        }
      });
    } finally {
      clearUserActionInProgress(petId);
    }

    return { available: true };
  });

  // ===== Graveyard =====

  ipcMain.handle("graveyard:load", () => {
    const game = loadGameState();
    return game.graveyard.slice(-10);
  });

  ipcMain.handle("graveyard:remove", (_, id: string) => {
    const game = loadGameState();
    game.graveyard = game.graveyard.filter(e => e.id !== id);
    saveGameState(game);
    return true;
  });

  // ===== Care History & Evolution =====
  registerCareIncrementHandler();
  registerEvolutionHandlers();

  // ===== Media Playback Service (Dance Feature) =====
  registerMediaPlaybackIpc();
}

// ─── Media Playback IPC ───

let mediaServiceState: MediaPlaybackServiceState | null = null;

function registerMediaPlaybackIpc(): void {
  // The overlay window may not exist yet at registration time.
  // Poll for it every 2 seconds until it appears, then start the service.
  const checkInterval = setInterval(() => {
    const overlay = getOverlayWindow();
    if (overlay && !overlay.isDestroyed()) {
      clearInterval(checkInterval);
      startMediaPlaybackService(overlay);
    }
  }, 2000);
}

export function startMediaPlaybackService(overlay: BrowserWindow): void {
  if (mediaServiceState) return; // Already running

  // Choose provider based on environment:
  // Try WindowsMediaProvider first (works in WSL2 and native Windows via powershell.exe)
  // Fall back to LinuxMprisProvider on native Linux
  // Fall back to NoopMediaProvider if nothing works
  //
  // Detection: check if powershell.exe is reachable (works in WSL2)
  let useWindows = false;
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-Command", "echo ok"], { timeout: 2000, stdio: "pipe" });
    useWindows = true;
  } catch {
    // powershell.exe not available
  }

  let provider: MediaProvider;
  if (useWindows) {
    console.log("[petmii:media] powershell.exe available — using WindowsMediaProvider");
    provider = new InlineWindowsMediaProvider();
  } else if (process.platform === "linux") {
    console.log("[petmii:media] Native Linux — using LinuxMprisProvider");
    provider = new LinuxMprisProvider();
  } else {
    console.log("[petmii:media] No media detection available — using NoopMediaProvider");
    provider = new NoopMediaProvider();
  }

  mediaServiceState = createMediaPlaybackService(provider, (state) => {
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send("media:playback-state", state);
    }
  });
}

export function stopMediaPlaybackService(): void {
  if (mediaServiceState) {
    destroyMediaPlaybackService(mediaServiceState);
    mediaServiceState = null;
  }
}

// ─── Inline Windows Media Provider (avoids module resolution issues with electron-vite) ───

const execFileAsync = promisify(execFile);

const PS_MEDIA_SCRIPT = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  "",
  "# Hybrid detection: window title + audio session check via tasklist",
  "# tasklist /fi shows if processes are using audio (have a 'Playing' status in their window title)",
  "# Chrome/Edge append a speaker icon or change title when audio is playing",
  "",
  "# Method: Check browser window titles for playback indicators",
  "# Chrome: title shows tab name when playing; we also look for the playing indicator",
  "# Firefox: title changes to include media title when playing",
  "$players = @()",
  "",
  "# Get browser processes with window titles",
  "$browsers = Get-Process -Name chrome,msedge,firefox 2>$null | Where-Object { $_.MainWindowTitle -ne '' }",
  "foreach ($b in $browsers) {",
  "  $name = $b.ProcessName.ToLower()",
  "  $title = $b.MainWindowTitle",
  "  $players += \"Playing`t$name`t$title`t\"",
  "}",
  "",
  "# Spotify desktop (title shows track name when playing, just 'Spotify' when paused)",
  "$spotify = Get-Process -Name Spotify 2>$null | Where-Object { $_.MainWindowTitle -ne '' -and $_.MainWindowTitle -ne 'Spotify' -and $_.MainWindowTitle -ne 'Spotify Premium' -and $_.MainWindowTitle -ne 'Spotify Free' }",
  "if ($spotify) {",
  "  $players += \"Playing`tspotify`t$($spotify.MainWindowTitle)`t\"",
  "}",
  "",
  "if ($players.Count -gt 0) {",
  "  Write-Output $players[0]",
  "} else {",
  "  Write-Output 'NO_SESSION'",
  "}",
].join("\n");

class InlineWindowsMediaProvider implements MediaProvider {
  private psAvailable: boolean | null = null;

  async poll(): Promise<MediaPlaybackState> {
    const now = Date.now();

    if (this.psAvailable === null) {
      try {
        await execFileAsync("powershell.exe", ["-NoProfile", "-Command", "echo ok"], { timeout: 3000 });
        this.psAvailable = true;
      } catch {
        console.warn("[petmii] powershell.exe media query failed — disabling WindowsMediaProvider");
        this.psAvailable = false;
      }
    }

    if (!this.psAvailable) {
      return { isPlaying: false, detectedAt: now };
    }

    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", PS_MEDIA_SCRIPT],
        { timeout: 4000 },
      );
      const trimmed = stdout.trim();
      console.log("[petmii:media] PowerShell raw output:", JSON.stringify(trimmed));
      return this.parseOutput(trimmed, now);
    } catch (err) {
      console.log("[petmii:media] PowerShell poll error:", (err as Error).message?.slice(0, 100));
      return { isPlaying: false, detectedAt: now };
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
