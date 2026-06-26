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
  clearEggNotifications: () => ipcRenderer.send("egg:clear-notifications"),
  onClearEggNotifications: (callback: () => void) => {
    ipcRenderer.on("egg:clear-notifications", () => callback());
  },

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

  // REST action (overlay) — main view sends rest command and listens for completion
  startOverlayRest: (data: { petId: string }) => ipcRenderer.send("pet:rest-start", data),
  isRestingInOverlay: (petId: string) => ipcRenderer.invoke("pet:is-resting", petId) as Promise<boolean>,
  onRestEnded: (callback: (data: { petId: string; completed: boolean }) => void) => {
    ipcRenderer.on("pet:rest-ended", (_, data) => callback(data));
  },

  // REST action IPC — overlay listens for rest command and sends completion
  onRestCommand: (callback: (data: { petId: string }) => void) => {
    ipcRenderer.on("overlay:rest-command", (_, data) => callback(data));
  },
  sendRestEnded: (data: { petId: string; completed: boolean }) => {
    ipcRenderer.send("pet:rest-ended", data);
  },

  // Graveyard
  loadGraveyard: () => ipcRenderer.invoke("graveyard:load"),
  removeFromGraveyard: (id: string) => ipcRenderer.invoke("graveyard:remove", id),

  // Care History
  careIncrement: (payload: { petId: string; action: string; metadata?: unknown }) =>
    ipcRenderer.invoke("care:increment", payload),

  // User Actions
  performAction: (payload: { petId: string; action: string }) =>
    ipcRenderer.invoke("pet:action", payload),

  // Evolution
  evolveStart: (payload: { petId: string; sessionId: string }) =>
    ipcRenderer.send("evolve:start", payload),
  evolveMidpoint: (payload: { petId: string; sessionId: string }) =>
    ipcRenderer.send("evolve:midpoint", payload),
  onEvolveStart: (callback: (data: unknown) => void) => {
    ipcRenderer.on("evolve:start", (_, data) => callback(data));
  },
  onEvolveComplete: (callback: (data: unknown) => void) => {
    ipcRenderer.on("evolve:complete", (_, data) => callback(data));
  },
  onEvolveRejected: (callback: (data: unknown) => void) => {
    ipcRenderer.on("evolve:rejected", (_, data) => callback(data));
  },

  // Autonomous Actions — overlay notifies main view when autonomous actions start/end
  sendAutonomousActionStarted: (data: { petId: string; action: string; durationMs?: number }) => ipcRenderer.send("pet:autonomous-action-started", data),
  sendAutonomousActionEnded: (data: { petId: string; action: string }) => ipcRenderer.send("pet:autonomous-action-ended", data),
  onAutonomousActionStarted: (callback: (data: { petId: string; action: string; durationMs?: number }) => void) => {
    ipcRenderer.on("pet:autonomous-action-started", (_, data) => callback(data));
  },
  onAutonomousActionEnded: (callback: (data: { petId: string; action: string }) => void) => {
    ipcRenderer.on("pet:autonomous-action-ended", (_, data) => callback(data));
  },
  isAutonomousActionActive: (petId: string) => ipcRenderer.invoke("pet:is-autonomous-action-active", petId) as Promise<boolean>,
  getAutonomousActionInfo: (petId: string) => ipcRenderer.invoke("pet:get-autonomous-action-info", petId) as Promise<{ action: string; remainingMs: number } | null>,

  // Cursor position (for cursor attraction controller)
  getCursorPosition: () => ipcRenderer.invoke("get-cursor-position") as Promise<{ x: number; y: number }>,

  // Media playback state (for dance feature)
  onMediaPlaybackState: (callback: (state: unknown) => void) => {
    ipcRenderer.on("media:playback-state", (_, state) => callback(state));
  },

  // System
  getSystemMetrics: () => ipcRenderer.invoke("system:get-metrics"),
});
