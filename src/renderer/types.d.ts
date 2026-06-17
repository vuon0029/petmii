// src/renderer/types.d.ts
// Global type declarations for the petmiiAPI exposed via preload script.

import type { PetState, PetVariant } from "./pet/petVariant";

export interface ProcessMetric {
  pid: number;
  type: string;
  name: string;
  cpu: {
    percentCPUUsage: number;
  };
  memory: {
    workingSetSize: number; // KB
    peakWorkingSetSize: number; // KB
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

declare global {
  interface Window {
    petmiiAPI: {
      loadPet(): Promise<PetState | null>;
      savePet(state: PetState): Promise<boolean>;
      clearPet(): Promise<boolean>;
      closeOverlay(): void;
      showOverlay(): void;
      hideOverlay(): void;
      enterOverlayMode(): void;
      exitOverlayMode(): void;
      updateOverlay(variant: PetVariant): void;
      updateOverlayState(petState: PetState): void;
      onVariantUpdate(callback: (variant: PetVariant) => void): void;
      onStateUpdate(callback: (petState: PetState) => void): void;
      onDirectionUpdate(callback: (direction: "left" | "right") => void): void;
      onRotationUpdate(callback: (degrees: number) => void): void;
      onPhysicsStateUpdate(callback: (state: "idle" | "flying" | "landed" | "getting-up") => void): void;
      overlayDragStart(screenX: number, screenY: number): void;
      overlayDragMove(screenX: number, screenY: number): void;
      overlayDragEnd(): void;
      getSystemMetrics(): Promise<SystemMetrics>;
    };
  }
}

export {};
