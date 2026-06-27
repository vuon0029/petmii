// src/main/careIncrementHandler.ts
// Centralized IPC handler for all care history increments.
// This is the ONLY path through which care history is mutated on disk.
// The renderer NEVER directly mutates persisted care history — it only
// sends IPC requests and receives updated state via broadcasts.

import { ipcMain, BrowserWindow } from "electron";
import { loadGameState, saveGameState } from "./petStorage";
import {
  incrementCareAction,
  ensureCareHistory,
  type CareAction,
  type CareCountMetadata,
} from "../shared/pet/careHistory";
import { PICKED_UP_HISTORY_COOLDOWN_MS } from "../shared/pet/careConstants";

interface CareIncrementPayload {
  petId: string;
  action: CareAction;
  metadata?: Partial<CareCountMetadata>;
}

/**
 * Registers the `care:increment` IPC handler.
 *
 * The main process is the AUTHORITATIVE cooldown enforcer for pickedUp.
 * The renderer may pre-check client-side but the main process always re-validates.
 *
 * Flow:
 * 1. Extract { petId, action, metadata } from payload
 * 2. Load LATEST game state from disk (not stale in-memory)
 * 3. Find pet by ID
 * 4. Derive authoritative life stage from pet.lifeStage
 * 5. If action === "pickedUp": enforce cooldown server-side
 * 6. Increment care action counts
 * 7. Save game state
 * 8. Broadcast updated state to all windows
 */
export function registerCareIncrementHandler(): void {
  ipcMain.handle(
    "care:increment",
    async (_, payload: CareIncrementPayload) => {
      const { petId, action, metadata } = payload;

      // 1. Load LATEST game state from disk
      const game = loadGameState();

      // 2. Find pet by ID
      const pet = game.pets.find((p) => p.id === petId);
      if (!pet) {
        return { success: false };
      }

      // 3. Ensure pet has careHistory
      const history = ensureCareHistory(pet.careHistory);

      // 4. Derive authoritative life stage from pet.lifeStage
      // Care actions don't apply to eggs
      if (pet.lifeStage === "egg") {
        return { success: false };
      }

      // Only "baby" | "child" | "adult" are valid for incrementCareAction
      const derivedStage = pet.lifeStage as "baby" | "child" | "adult";

      // 5. If action === "pickedUp": check cooldown server-side
      if (action === "pickedUp") {
        const lastCountedAt = history.metadata.pickedUpLastCountedAt;
        if (lastCountedAt !== null) {
          const elapsed = Date.now() - Date.parse(lastCountedAt);
          if (elapsed < PICKED_UP_HISTORY_COOLDOWN_MS) {
            // Cooldown has NOT expired — silently ignore
            return { success: false, reason: "cooldown" };
          }
        }
      }

      // 6. Increment care action
      const updatedHistory = incrementCareAction(history, action, derivedStage);

      // 7. Update pickedUpLastCountedAt metadata for pickedUp actions
      if (action === "pickedUp") {
        updatedHistory.metadata.pickedUpLastCountedAt =
          new Date().toISOString();
      }

      // 8. Assign updated history back to pet
      pet.careHistory = updatedHistory;

      // 9. Update timestamp
      pet.updatedAt = new Date().toISOString();

      // 10. Save game state to disk
      saveGameState(game);

      // 11. Broadcast to all windows
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send("game:state-update", game);
        }
      });

      return { success: true };
    }
  );
}
