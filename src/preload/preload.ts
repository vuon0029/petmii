// src/preload/preload.ts
// Exposes petmiiAPI to the renderer process via contextBridge.

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("petmiiAPI", {
  // Game state (multi-pet)
  loadGame: () => ipcRenderer.invoke("game:load"),
  saveGame: (state: unknown) => ipcRenderer.invoke("game:save", state),

  // Pet operations
  loadPets: () => ipcRenderer.invoke("pet:load"),
  savePet: (state: unknown) => ipcRenderer.invoke("pet:save", state),
  addPet: (state: unknown) => ipcRenderer.invoke("pet:add", state),
  removePet: (petId: string) => ipcRenderer.invoke("pet:remove", petId),
  clearPet: () => ipcRenderer.invoke("pet:clear"),

  // Legacy single-pet compat
  loadPet: () => ipcRenderer.invoke("game:load").then((g: { pets: unknown[] }) =>
    g.pets && g.pets.length > 0 ? g.pets[0] : null
  ),

  // Egg operations
  hatchEgg: (eggId: string) => ipcRenderer.invoke("egg:hatch", eggId),

  // Overlay settings
  getOverlayPets: () => ipcRenderer.invoke("overlay:get-pets"),
  setOverlayPets: (petIds: string[]) => ipcRenderer.invoke("overlay:set-pets", petIds),
  isOverlayVisible: () => ipcRenderer.invoke("overlay:is-visible"),

  // Window management
  closeOverlay: () => ipcRenderer.send("window:close-overlay"),
  showOverlay: () => ipcRenderer.send("window:show-overlay"),
  hideOverlay: () => ipcRenderer.send("window:hide-overlay"),
  enterOverlayMode: () => ipcRenderer.send("window:enter-overlay-mode"),
  exitOverlayMode: () => ipcRenderer.send("window:exit-overlay-mode"),
  setOverlayInteractive: (interactive: boolean) => ipcRenderer.send("overlay:set-interactive", interactive),
  updateOverlay: (variant: unknown) => ipcRenderer.send("window:update-overlay", variant),
  updateOverlayState: (petState: unknown) => ipcRenderer.send("window:update-overlay-state", petState),

  // IPC event listeners
  onVariantUpdate: (callback: (variant: unknown) => void) => {
    ipcRenderer.on("pet:variant-update", (_, variant) => callback(variant));
  },
  onStateUpdate: (callback: (petState: unknown) => void) => {
    ipcRenderer.on("pet:state-update", (_, petState) => callback(petState));
  },
  onGameStateUpdate: (callback: (game: unknown) => void) => {
    ipcRenderer.on("game:state-update", (_, game) => callback(game));
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
  onAllPetsDied: (callback: (pet: unknown) => void) => {
    ipcRenderer.on("pet:all-died", (_, pet) => callback(pet));
  },
  onEggFound: (callback: (data: unknown) => void) => {
    ipcRenderer.on("egg:found", (_, data) => callback(data));
  },

  // Graveyard
  loadGraveyard: () => ipcRenderer.invoke("graveyard:load"),
  removeFromGraveyard: (id: string) => ipcRenderer.invoke("graveyard:remove", id),

  // System
  getSystemMetrics: () => ipcRenderer.invoke("system:get-metrics"),
});
