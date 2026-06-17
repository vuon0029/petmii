// src/main/ipcHandlers.ts
// Registers IPC handlers bridging renderer to storage and window management.

import { app, ipcMain } from "electron";
import { loadPetState, savePetState, clearPetState } from "./petStorage";
import { loadGraveyard, removeFromGraveyard } from "./graveyard";
import {
  closeOverlayWindow,
  getOverlayWindow,
  showOverlay,
  hideOverlay,
  getMainWindow,
  restoreMainWindow,
  startDrag,
  moveDrag,
  endDrag,
} from "./windowManager";

export function registerIpcHandlers(): void {
  ipcMain.handle("pet:load", () => loadPetState());
  ipcMain.handle("pet:save", (_, state) => savePetState(state));
  ipcMain.handle("pet:clear", () => clearPetState());

  ipcMain.on("window:close-overlay", () => closeOverlayWindow());
  ipcMain.on("window:show-overlay", () => showOverlay());
  ipcMain.on("window:hide-overlay", () => hideOverlay());

  // Toggle overlay mode: minimize main window and show overlay
  ipcMain.on("window:enter-overlay-mode", () => {
    console.log("[petmii] IPC: enter-overlay-mode received");
    const main = getMainWindow();
    if (main) {
      main.minimize();
    }
    // Call showOverlay directly — don't rely on the minimize event
    showOverlay();
  });

  // Exit overlay mode: hide overlay and restore main window
  ipcMain.on("window:exit-overlay-mode", () => {
    hideOverlay();
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

  // Resource monitor: returns per-process CPU and memory metrics
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
          workingSetSize: m.memory.workingSetSize, // KB
          peakWorkingSetSize: m.memory.peakWorkingSetSize, // KB
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

  // Overlay drag & drop with gravity
  ipcMain.on("window:overlay-drag-start", (_, screenX, screenY) => {
    startDrag(screenX, screenY);
  });

  ipcMain.on("window:overlay-drag-move", (_, screenX, screenY) => {
    moveDrag(screenX, screenY);
  });

  ipcMain.on("window:overlay-drag-end", () => {
    endDrag();
  });

  // Graveyard
  ipcMain.handle("graveyard:load", () => loadGraveyard());
  ipcMain.handle("graveyard:remove", (_, id: string) => {
    removeFromGraveyard(id);
    return true;
  });
}
