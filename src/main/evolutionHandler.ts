// src/main/evolutionHandler.ts
// Evolution IPC handlers for the main process.
// Manages evolve:start and evolve:midpoint channels, validates readiness,
// derives targetStage, and commits life-stage + trait at midpoint.

import { ipcMain, BrowserWindow } from "electron";
import { loadGameState, saveGameState } from "./petStorage";
import { getEvolutionReadiness } from "../shared/pet/evolutionReadiness";
import { calculateAdultTrait } from "../shared/pet/traitScoring";
import { ensureCareHistory } from "../shared/pet/careHistory";
import { getMainWindow, getOverlayWindow, isOverlayVisible } from "./windowManager";

interface ActiveEvolutionSession {
  petId: string;
  sessionId: string;
  targetStage: "child" | "adult";
  committed: boolean;
}

/** Active evolution sessions keyed by sessionId */
const activeSessions = new Map<string, ActiveEvolutionSession>();

export function registerEvolutionHandlers(): void {
  // ===== evolve:start — one-way from renderer (main view) =====
  ipcMain.on("evolve:start", (_event, data: { petId: string; sessionId: string }) => {
    const { petId, sessionId } = data;
    console.log("[petmii] evolve:start received for petId:", petId);

    // Load latest game state from disk
    const game = loadGameState();
    const pet = game.pets.find((p) => p.id === petId);

    if (!pet) {
      // Pet not found — send rejection
      console.log("[petmii] evolve:start REJECTED — pet not found");
      const mainWin = getMainWindow();
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send("evolve:rejected", { petId, sessionId });
      }
      return;
    }

    // Derive evolution readiness
    const readiness = getEvolutionReadiness({
      species: pet.species,
      lifeStage: pet.lifeStage as "baby" | "child" | "adult",
      hatchedAt: Date.parse(pet.hatchedAt),
    });

    console.log("[petmii] evolve:start readiness:", JSON.stringify(readiness), "lifeStage:", pet.lifeStage, "species:", pet.species, "hatchedAt:", pet.hatchedAt);

    if (!readiness.isReady) {
      // Not ready — send rejection to main view
      console.log("[petmii] evolve:start REJECTED — not ready, remainingHours:", readiness.remainingHours);
      const mainWin = getMainWindow();
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send("evolve:rejected", { petId, sessionId });
      }
      return;
    }

    // Determine target stage
    let targetStage: "child" | "adult";
    if (pet.lifeStage === "baby") {
      targetStage = "child";
    } else if (pet.lifeStage === "child") {
      targetStage = "adult";
    } else {
      // Adult cannot evolve — reject
      const mainWin = getMainWindow();
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send("evolve:rejected", { petId, sessionId });
      }
      return;
    }

    // Store active session
    activeSessions.set(sessionId, {
      petId,
      sessionId,
      targetStage,
      committed: false,
    });

    // Forward to overlay window for animation, or commit immediately if no overlay
    const overlay = getOverlayWindow();
    if (overlay && !overlay.isDestroyed() && isOverlayVisible()) {
      overlay.webContents.send("evolve:start", { petId, sessionId, targetStage });
    } else {
      // No overlay active — commit evolution immediately (skip animation)
      commitEvolution(sessionId);
    }
  });

  // ===== evolve:midpoint — one-way from overlay =====
  ipcMain.on("evolve:midpoint", (_event, data: { petId: string; sessionId: string }) => {
    const { sessionId } = data;
    commitEvolution(sessionId);
  });
}

/**
 * Commits an evolution session — advances life stage, assigns adult trait if applicable,
 * persists game state, and broadcasts results.
 */
function commitEvolution(sessionId: string): void {
    // Look up session
    const session = activeSessions.get(sessionId);
    if (!session || session.committed) {
      // Not found or already committed — ignore silently
      return;
    }

    // Load latest game state from disk
    const game = loadGameState();
    const pet = game.pets.find((p) => p.id === session.petId);

    if (!pet) {
      return;
    }

    // Commit new life stage
    pet.lifeStage = session.targetStage;

    // If evolving to adult, calculate and assign adult trait
    if (session.targetStage === "adult") {
      const history = ensureCareHistory(pet.careHistory);
      pet.adultTrait = calculateAdultTrait(history);
      // Assign careHistory if it wasn't already set
      if (!pet.careHistory) {
        pet.careHistory = history;
      }
    }

    pet.updatedAt = new Date().toISOString();

    // Mark session as committed
    session.committed = true;

    // Save game state
    saveGameState(game);

    // Broadcast game:state-update to all windows
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("game:state-update", game);
      }
    }

    // Send evolve:complete to main window
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send("evolve:complete", {
        petId: session.petId,
        newStage: session.targetStage,
        adultTrait: pet.adultTrait || null,
      });
    }
}
