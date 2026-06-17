"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("petmiiAPI", {
  loadPet: () => electron.ipcRenderer.invoke("pet:load"),
  savePet: (state) => electron.ipcRenderer.invoke("pet:save", state),
  clearPet: () => electron.ipcRenderer.invoke("pet:clear"),
  closeOverlay: () => electron.ipcRenderer.send("window:close-overlay"),
  showOverlay: () => electron.ipcRenderer.send("window:show-overlay"),
  hideOverlay: () => electron.ipcRenderer.send("window:hide-overlay"),
  enterOverlayMode: () => electron.ipcRenderer.send("window:enter-overlay-mode"),
  exitOverlayMode: () => electron.ipcRenderer.send("window:exit-overlay-mode"),
  updateOverlay: (variant) => electron.ipcRenderer.send("window:update-overlay", variant),
  updateOverlayState: (petState) => electron.ipcRenderer.send("window:update-overlay-state", petState),
  onVariantUpdate: (callback) => {
    electron.ipcRenderer.on("pet:variant-update", (_, variant) => callback(variant));
  },
  onStateUpdate: (callback) => {
    electron.ipcRenderer.on("pet:state-update", (_, petState) => callback(petState));
  },
  onDirectionUpdate: (callback) => {
    electron.ipcRenderer.on("pet:direction", (_, direction) => callback(direction));
  },
  onRotationUpdate: (callback) => {
    electron.ipcRenderer.on("pet:rotation", (_, degrees) => callback(degrees));
  },
  onPhysicsStateUpdate: (callback) => {
    electron.ipcRenderer.on("pet:physics-state", (_, state) => callback(state));
  },
  onPetDied: (callback) => {
    electron.ipcRenderer.on("pet:died", (_, pet) => callback(pet));
  },
  loadGraveyard: () => electron.ipcRenderer.invoke("graveyard:load"),
  removeFromGraveyard: (id) => electron.ipcRenderer.invoke("graveyard:remove", id),
  overlayDragStart: (screenX, screenY) => electron.ipcRenderer.send("window:overlay-drag-start", screenX, screenY),
  overlayDragMove: (screenX, screenY) => electron.ipcRenderer.send("window:overlay-drag-move", screenX, screenY),
  overlayDragEnd: () => electron.ipcRenderer.send("window:overlay-drag-end"),
  getSystemMetrics: () => electron.ipcRenderer.invoke("system:get-metrics")
});
