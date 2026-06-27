import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { render, screen, fireEvent, act, waitFor, cleanup } from "@testing-library/react";
import { App } from "../App";
import type { GameState } from "../types";

/**
 * Property 1: Bug Condition - Egg Notifications Persist on Eggs Tab Switch
 *
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2
 *
 * This test encodes the EXPECTED behavior: when the user navigates to the Eggs tab,
 * `clearEggNotifications()` should be called on petmiiAPI.
 *
 * On UNFIXED code, this test MUST FAIL because:
 * - `clearEggNotifications` does not exist on petmiiAPI type declarations
 * - No IPC channel `egg:clear-notifications` exists
 * - `App.tsx` does not call any notification clearing when switching to Eggs tab
 *
 * The failure confirms the bug exists. After the fix is implemented, this test will pass.
 */

// Arbitrary: generate a random count of overlay pets with hasFoundEgg: true (1-5)
// This represents the number of overlay pets that have found eggs and have active notifications
const overlayPetCountArb = fc.integer({ min: 1, max: 5 });

// Generate a game state that has pets (so App renders in "pets" view)
function createMockGameState(petCount: number): GameState {
  const pets = Array.from({ length: petCount }, (_, i) => ({
    id: `pet-${i}`,
    name: `Pet ${i}`,
    species: "blob" as const,
    color: "cream",
    personality: "sweet",
    hunger: 50,
    happiness: 50,
    energy: 50,
    cleanliness: 50,
    bond: 10,
    hp: 100,
    isAlive: true,
    mood: "happy",
    lifeStage: "baby" as const,
    lastMessage: "Hello!",
    lastFedAt: null,
    lastPlayedAt: null,
    lastCleanedAt: null,
    lastRestedAt: null,
    diedAt: null,
    hatchedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    isShiny: false,
  }));

  return {
    pets,
    eggs: [],
    graveyard: [],
    settings: {
      overlayPets: pets.map((p) => p.id),
      petScale: 1.5,
    },
  };
}

let mockClearEggNotifications: ReturnType<typeof vi.fn>;

function setupMockAPI(gameState: GameState) {
  mockClearEggNotifications = vi.fn();

  (window as any).petmiiAPI = {
    // Game state
    loadGame: vi.fn().mockResolvedValue(gameState),
    saveGame: vi.fn().mockResolvedValue(true),

    // Pet operations
    loadPets: vi.fn().mockResolvedValue(gameState.pets),
    savePet: vi.fn().mockResolvedValue(true),
    addPet: vi.fn().mockResolvedValue(true),
    removePet: vi.fn().mockResolvedValue(true),
    clearPet: vi.fn().mockResolvedValue(true),
    loadPet: vi.fn().mockResolvedValue(null),

    // Egg operations
    hatchEgg: vi.fn().mockResolvedValue(null),

    // Overlay settings
    getOverlayPets: vi.fn().mockResolvedValue([]),
    setOverlayPets: vi.fn().mockResolvedValue(true),
    isOverlayVisible: vi.fn().mockResolvedValue(false),

    // Window management
    closeOverlay: vi.fn(),
    showOverlay: vi.fn(),
    hideOverlay: vi.fn(),
    enterOverlayMode: vi.fn(),
    exitOverlayMode: vi.fn(),
    setOverlayInteractive: vi.fn(),
    updateOverlay: vi.fn(),
    updateOverlayState: vi.fn(),

    // Event listeners (no-op callbacks)
    onVariantUpdate: vi.fn(),
    onStateUpdate: vi.fn(),
    onGameStateUpdate: vi.fn(),
    onDirectionUpdate: vi.fn(),
    onRotationUpdate: vi.fn(),
    onPhysicsStateUpdate: vi.fn(),
    onPetDied: vi.fn(),
    onAllPetsDied: vi.fn(),
    onEggFound: vi.fn(),
    onRestEnded: vi.fn(),
    onAutonomousActionStarted: vi.fn(),
    onAutonomousActionEnded: vi.fn(),
    onEvolveStart: vi.fn(),
    onEvolveComplete: vi.fn(),
    onEvolveRejected: vi.fn(),

    // REST action
    startOverlayRest: vi.fn(),
    isRestingInOverlay: vi.fn().mockResolvedValue(false),
    onRestCommand: vi.fn(),
    sendRestEnded: vi.fn(),

    // Graveyard
    loadGraveyard: vi.fn().mockResolvedValue([]),
    removeFromGraveyard: vi.fn().mockResolvedValue(true),

    // Care History
    careIncrement: vi.fn().mockResolvedValue({ success: true }),

    // Evolution
    evolveStart: vi.fn(),
    evolveMidpoint: vi.fn(),

    // Autonomous Actions
    sendAutonomousActionStarted: vi.fn(),
    sendAutonomousActionEnded: vi.fn(),
    isAutonomousActionActive: vi.fn().mockResolvedValue(false),
    getAutonomousActionInfo: vi.fn().mockResolvedValue(null),

    // System
    getSystemMetrics: vi.fn().mockResolvedValue({ processes: [], mainProcess: { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 } }),

    // Cursor position
    getCursorPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),

    // Bug fix method - this is what SHOULD be called but ISN'T on unfixed code
    clearEggNotifications: mockClearEggNotifications,
    onClearEggNotifications: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
});

describe("Property 1: Bug Condition - Egg Notifications Persist on Eggs Tab Switch", () => {
  /**
   * Validates: Requirements 2.1, 2.2
   *
   * For any number of overlay pets with hasFoundEgg: true, when the user clicks the
   * "🥚 Eggs" tab button, clearEggNotifications() should be called.
   *
   * On UNFIXED code: this FAILS because App.tsx does NOT call clearEggNotifications()
   * when switching to the Eggs tab.
   *
   * Bug Condition: isBugCondition(X) = X.targetTab = "eggs" AND EXISTS pet IN X.overlayPets WHERE pet.hasFoundEgg = true
   */
  it("should call clearEggNotifications when Eggs tab button is clicked (EXPECTED TO FAIL on unfixed code)", async () => {
    await fc.assert(
      fc.asyncProperty(
        overlayPetCountArb,
        async (petCount) => {
          // petCount represents how many overlay pets have hasFoundEgg: true
          // The bug: App.tsx does NOT call clearEggNotifications() on Eggs tab switch
          cleanup();
          const gameState = createMockGameState(petCount);
          setupMockAPI(gameState);

          // Render the App and wait for it to load
          render(<App />);

          // Wait for the async loadGame to resolve and the component to render tabs
          await waitFor(() => {
            expect(screen.getByRole("button", { name: /Eggs/i })).toBeTruthy();
          });

          // Click the Eggs tab button
          await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /Eggs/i }));
          });

          // Assert: clearEggNotifications should have been called
          // This WILL FAIL on unfixed code because App.tsx doesn't call it
          expect(mockClearEggNotifications).toHaveBeenCalledTimes(1);
        },
      ),
      { numRuns: 10 },
    );
  });

  /**
   * Validates: Requirements 1.2, 2.2
   *
   * For any number of overlay pets with hasFoundEgg: true, when the user clicks the
   * "View Eggs" button (no-pets message path), clearEggNotifications() should be called.
   *
   * On UNFIXED code: this FAILS because App.tsx does NOT call clearEggNotifications()
   * when switching to the Eggs tab via "View Eggs" button.
   */
  it("should call clearEggNotifications when 'View Eggs' button is clicked (EXPECTED TO FAIL on unfixed code)", async () => {
    await fc.assert(
      fc.asyncProperty(
        overlayPetCountArb,
        async (petCount) => {
          // For this test, game has NO pets but some eggs — this shows the "View Eggs" button
          cleanup();
          const emptyPetsGameState: GameState = {
            pets: [],
            eggs: Array.from({ length: petCount }, (_, i) => ({
              id: `egg-${i}`,
              species: "blob" as const,
              isShiny: false,
              foundAt: "2024-01-01",
              hatchAt: "2024-01-02",
              foundBy: `pet-${i}`,
            })),
            graveyard: [],
            settings: { overlayPets: [], petScale: 1.5 },
          };
          setupMockAPI(emptyPetsGameState);

          render(<App />);

          // Wait for the "View Eggs" button to appear (shown when no pets exist)
          await waitFor(() => {
            expect(screen.getByRole("button", { name: /View Eggs/i })).toBeTruthy();
          });

          // Click the "View Eggs" button
          await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /View Eggs/i }));
          });

          // Assert: clearEggNotifications should have been called
          // This WILL FAIL on unfixed code because App.tsx doesn't call it
          expect(mockClearEggNotifications).toHaveBeenCalledTimes(1);
        },
      ),
      { numRuns: 10 },
    );
  });
});
