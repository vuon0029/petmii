// src/preload/preload.ts
// Exposes petmiiAPI to the renderer process via contextBridge.

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("petmiiAPI", {
  loadPet: () => ipcRenderer.invoke("pet:load"),
  savePet: (state: unknown) => ipcRenderer.invoke("pet:save", state),
  clearPet: () => ipcRenderer.invoke("pet:clear"),
  closeOverlay: () => ipcRenderer.send("window:close-overlay"),
  showOverlay: () => ipcRenderer.send("window:show-overlay"),
  hideOverlay: () => ipcRenderer.send("window:hide-overlay"),
  enterOverlayMode: () => ipcRenderer.send("window:enter-overlay-mode"),
  exitOverlayMode: () => ipcRenderer.send("window:exit-overlay-mode"),
  updateOverlay: (variant: unknown) => ipcRenderer.send("window:update-overlay", variant),
  updateOverlayState: (petState: unknown) => ipcRenderer.send("window:update-overlay-state", petState),
  onVariantUpdate: (callback: (variant: unknown) => void) => {
    ipcRenderer.on("pet:variant-update", (_, variant) => callback(variant));
  },
  onStateUpdate: (callback: (petState: unknown) => void) => {
    ipcRenderer.on("pet:state-update", (_, petState) => callback(petState));
  },
  onDirectionUpdate: (callback: (direction: unknown) => void) => {
    ipcRenderer.on("pet:direction", (_, direction) => callback(direction));
  },
  onRotationUpdate: (callback: (degrees: unknown) => void) => {
    ipcRenderer.on("pet:rotation", (_, degrees) => callback(degrees));
  },
  onPhysicsStateUpdate: (callback: (state: unknown) => void) => {
    ipcRenderer.on("pet:physics-state", (_, state) => callback(state));
  },
  onPetDied: (callback: (pet: unknown) => void) => {
    ipcRenderer.on("pet:died", (_, pet) => callback(pet));
  },
  loadGraveyard: () => ipcRenderer.invoke("graveyard:load"),
  removeFromGraveyard: (id: string) => ipcRenderer.invoke("graveyard:remove", id),
  overlayDragStart: (screenX: number, screenY: number) =>
    ipcRenderer.send("window:overlay-drag-start", screenX, screenY),
  overlayDragMove: (screenX: number, screenY: number) =>
    ipcRenderer.send("window:overlay-drag-move", screenX, screenY),
  overlayDragEnd: () => ipcRenderer.send("window:overlay-drag-end"),
  getSystemMetrics: () => ipcRenderer.invoke("system:get-metrics"),
});
