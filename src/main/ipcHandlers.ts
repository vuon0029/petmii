// src/main/ipcHandlers.ts
// Registers IPC handlers bridging renderer to storage and window management.

import { app, ipcMain } from "electron";
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
    return result;
  });

  ipcMain.handle("pet:add", (_, state: PetState) => {
    const result = addPet(state);
    console.log("[petmii] IPC pet:add →", result ? "success" : "FAILED (max reached?)", state?.name);
    return result;
  });

  ipcMain.handle("pet:remove", (_, petId: string) => {
    const result = removePet(petId);
    console.log("[petmii] IPC pet:remove →", result ? "success" : "FAILED", petId);
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

  // ===== Graveyard =====

  ipcMain.handle("graveyard:load", () => {
    const game = loadGameState();
    return game.graveyard;
  });

  ipcMain.handle("graveyard:remove", (_, id: string) => {
    const game = loadGameState();
    game.graveyard = game.graveyard.filter(e => e.id !== id);
    saveGameState(game);
    return true;
  });
}
