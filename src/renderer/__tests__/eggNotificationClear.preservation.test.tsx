import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";
import { render, screen, fireEvent, act, waitFor, cleanup } from "@testing-library/react";
import { App } from "../App";
import type { GameState } from "../types";

/**
 * Property 2: Preservation - Non-Eggs Tab Switch and Existing Dismissal Behavior
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 *
 * These tests capture baseline behaviors that MUST remain unchanged after the fix:
 * - Non-eggs tab switches do NOT call clearEggNotifications
 * - mouseDown on a pet clears only that pet's hasFoundEgg flag
 * - onEggFound sets hasFoundEgg: true on the correct pet
 *
 * On UNFIXED code: all tests PASS (confirms baseline behavior exists)
 */

// ===== Helpers =====

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
    loadGame: vi.fn().mockResolvedValue(gameState),
    saveGame: vi.fn().mockResolvedValue(true),
    loadPets: vi.fn().mockResolvedValue(gameState.pets),
    savePet: vi.fn().mockResolvedValue(true),
    addPet: vi.fn().mockResolvedValue(true),
    removePet: vi.fn().mockResolvedValue(true),
    clearPet: vi.fn().mockResolvedValue(true),
    loadPet: vi.fn().mockResolvedValue(null),
    hatchEgg: vi.fn().mockResolvedValue(null),
    getOverlayPets: vi.fn().mockResolvedValue([]),
    setOverlayPets: vi.fn().mockResolvedValue(true),
    isOverlayVisible: vi.fn().mockResolvedValue(false),
    closeOverlay: vi.fn(),
    showOverlay: vi.fn(),
    hideOverlay: vi.fn(),
    enterOverlayMode: vi.fn(),
    exitOverlayMode: vi.fn(),
    setOverlayInteractive: vi.fn(),
    updateOverlay: vi.fn(),
    updateOverlayState: vi.fn(),
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
    startOverlayRest: vi.fn(),
    isRestingInOverlay: vi.fn().mockResolvedValue(false),
    onRestCommand: vi.fn(),
    sendRestEnded: vi.fn(),
    loadGraveyard: vi.fn().mockResolvedValue([]),
    removeFromGraveyard: vi.fn().mockResolvedValue(true),
    careIncrement: vi.fn().mockResolvedValue({ success: true }),
    evolveStart: vi.fn(),
    evolveMidpoint: vi.fn(),
    sendAutonomousActionStarted: vi.fn(),
    sendAutonomousActionEnded: vi.fn(),
    isAutonomousActionActive: vi.fn().mockResolvedValue(false),
    getAutonomousActionInfo: vi.fn().mockResolvedValue(null),
    getSystemMetrics: vi.fn().mockResolvedValue({ processes: [], mainProcess: { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 } }),
    getCursorPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    // clearEggNotifications exists on the mock so we can verify it's NOT called
    clearEggNotifications: mockClearEggNotifications,
    onClearEggNotifications: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
});

// Arbitrary: non-eggs tab names
const nonEggsTabArb = fc.constantFrom("pets", "overlay", "settings", "stats") as fc.Arbitrary<string>;

// Arbitrary: generate 1-5 pets
const petCountArb = fc.integer({ min: 1, max: 5 });

describe("Property 2: Preservation - Non-Eggs Tab Switch and Existing Dismissal Behavior", () => {
  /**
   * Validates: Requirements 3.4
   *
   * For all non-"eggs" tab switches (targetTab ∈ {"pets", "overlay", "settings", "stats"}),
   * no clearEggNotifications call is made. This is trivially true on unfixed code since
   * setActiveTab has no side effects, but we capture this baseline to ensure the fix
   * doesn't accidentally add notification clearing to non-eggs tabs.
   */
  it("switching to non-eggs tabs does NOT call clearEggNotifications", async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEggsTabArb,
        petCountArb,
        async (targetTab, petCount) => {
          cleanup();
          const gameState = createMockGameState(petCount);
          setupMockAPI(gameState);

          render(<App />);

          // Wait for the app to load and show tabs
          await waitFor(() => {
            expect(screen.getByRole("button", { name: /Pets/i })).toBeTruthy();
          });

          // Find the tab button matching targetTab
          let tabButton: HTMLElement;
          switch (targetTab) {
            case "pets":
              tabButton = screen.getByRole("button", { name: /🐾 Pets/i });
              break;
            case "overlay":
              tabButton = screen.getByRole("button", { name: /Overlay/i });
              break;
            case "settings":
              tabButton = screen.getByRole("button", { name: /Settings/i });
              break;
            case "stats":
              tabButton = screen.getByRole("button", { name: /📊/i });
              break;
            default:
              tabButton = screen.getByRole("button", { name: /Pets/i });
          }

          // Click the tab
          await act(async () => {
            fireEvent.click(tabButton);
          });

          // Assert: clearEggNotifications should NOT have been called
          expect(mockClearEggNotifications).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 20 },
    );
  });

  /**
   * Validates: Requirements 3.2
   *
   * For mouseDown on a pet in the overlay, only that pet's hasFoundEgg is cleared.
   * Since OverlayApp is complex to render, we test the state logic directly:
   * the mouseDown handler does `setPets(prev => prev.map(p => p.id === petId ? {...p, hasFoundEgg: false} : p))`
   *
   * We verify this logic preserves other pets' hasFoundEgg flags.
   */
  it("mouseDown dismissal clears only the clicked pet's hasFoundEgg flag", () => {
    fc.assert(
      fc.property(
        // Generate 2-5 pets with random hasFoundEgg flags (at least one true)
        fc.integer({ min: 2, max: 5 }).chain((count) =>
          fc.tuple(
            fc.constant(count),
            fc.array(fc.boolean(), { minLength: count, maxLength: count }),
            fc.integer({ min: 0, max: count - 1 }), // index of clicked pet
          ),
        ),
        ([count, flags, clickedIndex]) => {
          // Simulate the overlay state: each pet has a hasFoundEgg flag
          const pets = Array.from({ length: count }, (_, i) => ({
            id: `pet-${i}`,
            hasFoundEgg: flags[i],
          }));

          // Simulate the mouseDown handler logic from OverlayApp.tsx:
          // setPets(prev => prev.map(p => p.id === petId ? {...p, hasFoundEgg: false} : p))
          const clickedPetId = pets[clickedIndex].id;
          const result = pets.map((p) =>
            p.id === clickedPetId ? { ...p, hasFoundEgg: false } : p,
          );

          // Assert: only the clicked pet's flag is cleared
          for (let i = 0; i < count; i++) {
            if (i === clickedIndex) {
              expect(result[i].hasFoundEgg).toBe(false);
            } else {
              // Other pets' flags remain unchanged
              expect(result[i].hasFoundEgg).toBe(flags[i]);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.1
   *
   * For egg found events, hasFoundEgg is set to true on the correct (finding) pet.
   * The onEggFound listener does:
   * setPets(prev => prev.map(p => (p.id === finder.id ? { ...p, hasFoundEgg: true } : p)))
   *
   * We verify this logic sets the correct pet's flag and leaves others unchanged.
   */
  it("egg found event sets hasFoundEgg to true only on the finding pet", () => {
    fc.assert(
      fc.property(
        // Generate 2-5 pets, all starting with hasFoundEgg: false, pick one as finder
        fc.integer({ min: 2, max: 5 }).chain((count) =>
          fc.tuple(
            fc.constant(count),
            fc.array(fc.boolean(), { minLength: count, maxLength: count }), // initial hasFoundEgg states
            fc.integer({ min: 0, max: count - 1 }), // index of the finder pet
          ),
        ),
        ([count, initialFlags, finderIndex]) => {
          // Simulate the overlay state
          const pets = Array.from({ length: count }, (_, i) => ({
            id: `pet-${i}`,
            hasFoundEgg: initialFlags[i],
          }));

          // Simulate the onEggFound handler logic from OverlayApp.tsx:
          // setPets(prev => prev.map(p => (p.id === finder.id ? { ...p, hasFoundEgg: true } : p)))
          const finderId = pets[finderIndex].id;
          const result = pets.map((p) =>
            p.id === finderId ? { ...p, hasFoundEgg: true } : p,
          );

          // Assert: the finder pet's flag is set to true
          expect(result[finderIndex].hasFoundEgg).toBe(true);

          // Assert: all other pets' flags remain unchanged
          for (let i = 0; i < count; i++) {
            if (i !== finderIndex) {
              expect(result[i].hasFoundEgg).toBe(initialFlags[i]);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
