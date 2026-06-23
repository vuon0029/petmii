// src/renderer/types.d.ts
// Global type declarations for the petmiiAPI exposed via preload script.

import type { PetState, PetVariant, PetSpecies } from "./pet/petVariant";

export interface Egg {
  id: string;
  species: PetSpecies;
  isShiny: boolean;
  foundAt: string;
  hatchAt: string;
  foundBy: string;
  status?: "found" | "incubating" | "readyToHatch";
  incubationStartedAt?: string;
  incubationDurationMs?: number;
  hatchesAt?: string;
}

export interface GameState {
  pets: PetState[];
  eggs: Egg[];
  graveyard: GraveyardEntry[];
  settings: {
    overlayPets: string[];
    petScale: number;
  };
}

export interface ProcessMetric {
  pid: number;
  type: string;
  name: string;
  cpu: {
    percentCPUUsage: number;
  };
  memory: {
    workingSetSize: number;
    peakWorkingSetSize: number;
  };
}

export interface SystemMetrics {
  processes: ProcessMetric[];
  mainProcess: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

export interface GraveyardEntry {
  id: string;
  name: string;
  species: string;
  color: string;
  personality: string;
  isShiny: boolean;
  hatchedAt: string;
  diedAt: string;
}

declare global {
  interface Window {
    petmiiAPI: {
      // Game state
      loadGame(): Promise<GameState>;
      saveGame(state: GameState): Promise<boolean>;

      // Pet operations
      loadPets(): Promise<PetState[]>;
      savePet(state: PetState): Promise<boolean>;
      addPet(state: PetState): Promise<boolean>;
      removePet(petId: string): Promise<boolean>;
      clearPet(): Promise<boolean>;
      loadPet(): Promise<PetState | null>;

      // Egg operations
      hatchEgg(eggId: string): Promise<Egg | null>;

      // Overlay settings
      getOverlayPets(): Promise<string[]>;
      setOverlayPets(petIds: string[]): Promise<boolean>;
      isOverlayVisible(): Promise<boolean>;

      // Window management
      closeOverlay(): void;
      showOverlay(): void;
      hideOverlay(): void;
      enterOverlayMode(): void;
      exitOverlayMode(): void;
      setOverlayInteractive(interactive: boolean): void;
      updateOverlay(variant: PetVariant): void;
      updateOverlayState(petState: PetState): void;

      // Event listeners
      onVariantUpdate(callback: (variant: PetVariant) => void): void;
      onStateUpdate(callback: (petState: PetState) => void): void;
      onGameStateUpdate(callback: (game: GameState) => void): void;
      onDirectionUpdate(callback: (direction: "left" | "right") => void): void;
      onRotationUpdate(callback: (degrees: number) => void): void;
      onPhysicsStateUpdate(callback: (state: "idle" | "flying" | "landed" | "getting-up") => void): void;
      onPetDied(callback: (pet: PetState) => void): void;
      onAllPetsDied(callback: (pet: PetState) => void): void;
      onEggFound(callback: (data: { finder: PetState; egg: Egg }) => void): void;

      // Egg notification clearing
      clearEggNotifications(): void;
      onClearEggNotifications(callback: () => void): void;

      // REST action (overlay) — main view sends rest command and listens for completion
      startOverlayRest(data: { petId: string }): void;
      isRestingInOverlay(petId: string): Promise<boolean>;
      onRestEnded(callback: (data: { petId: string; completed: boolean }) => void): void;
      // REST action IPC — overlay listens for rest command and sends completion
      onRestCommand(callback: (data: { petId: string }) => void): void;
      sendRestEnded(data: { petId: string; completed: boolean }): void;

      // Graveyard
      loadGraveyard(): Promise<GraveyardEntry[]>;
      removeFromGraveyard(id: string): Promise<boolean>;

      // Care History
      careIncrement(payload: { petId: string; action: string; metadata?: unknown }): Promise<{ success: boolean; reason?: string }>;

      // Evolution
      evolveStart(payload: { petId: string; sessionId: string }): void;
      evolveMidpoint(payload: { petId: string; sessionId: string }): void;
      onEvolveStart(callback: (data: { petId: string; sessionId: string; targetStage: string }) => void): void;
      onEvolveComplete(callback: (data: { petId: string; newStage: string; adultTrait: string | null }) => void): void;
      onEvolveRejected(callback: (data: { petId: string; sessionId: string }) => void): void;

      // Autonomous Actions
      sendAutonomousActionStarted(data: { petId: string; action: string; durationMs?: number }): void;
      sendAutonomousActionEnded(data: { petId: string; action: string }): void;
      onAutonomousActionStarted(callback: (data: { petId: string; action: string; durationMs?: number }) => void): void;
      onAutonomousActionEnded(callback: (data: { petId: string; action: string }) => void): void;
      isAutonomousActionActive(petId: string): Promise<boolean>;
      getAutonomousActionInfo(petId: string): Promise<{ action: string; remainingMs: number } | null>;

      // System
      getSystemMetrics(): Promise<SystemMetrics>;

      // Cursor position (for cursor attraction controller)
      getCursorPosition(): Promise<{ x: number; y: number }>;
    };
  }
}

export {};
