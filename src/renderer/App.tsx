import { useState, useEffect, useCallback } from "react";
import { generateRandomPet } from "./pet/generateRandomPet";
import {
  DEFAULT_PET_STATS,
  PetState,
  SPECIES_DEFAULT_NAMES,
} from "./pet/petVariant";
import { EggHatchScreen } from "./components/EggHatchScreen";
import { PetDetails } from "./components/PetDetails";
import { RenamePetModal } from "./components/RenamePetModal";
import { DeathScreen } from "./components/DeathScreen";
import { EggList } from "./components/EggList";
import { ResourceMonitor } from "./components/ResourceMonitor";
import type { GameState, Egg } from "./types";

type AppView = "loading" | "egg-ready" | "hatching" | "pets" | "death";

export function App() {
  const [view, setView] = useState<AppView>("loading");
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedPetIndex, setSelectedPetIndex] = useState(0);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [pendingPet, setPendingPet] = useState<ReturnType<
    typeof generateRandomPet
  > | null>(null);
  const [lastDead, setLastDead] = useState<PetState | null>(null);
  const [activeTab, setActiveTab] = useState<
    "pets" | "eggs" | "overlay" | "stats"
  >("pets");
  const [overlayOn, setOverlayOn] = useState(false);

  // Load game state on mount
  useEffect(() => {
    async function init() {
      const loaded = await window.petmiiAPI.loadGame();
      setGame(loaded);

      // Sync overlay toggle with actual state
      const overlayVisible = await window.petmiiAPI.isOverlayVisible();
      setOverlayOn(overlayVisible);

      if (loaded.pets.length > 0) {
        setView("pets");
      } else if (loaded.eggs.length > 0) {
        setView("pets");
      } else {
        setView("egg-ready");
      }
    }
    init();
  }, []);

  // Listen for game state updates from decay engine
  useEffect(() => {
    window.petmiiAPI.onGameStateUpdate((updated) => {
      setGame(updated as GameState);
    });

    window.petmiiAPI.onAllPetsDied((pet) => {
      setLastDead(pet as PetState);
      setView("death");
    });

    window.petmiiAPI.onPetDied((pet) => {
      // Individual pet died but others still alive — just refresh
      // Game state will be updated via onGameStateUpdate
    });
  }, []);

  // Selected pet from game state
  const selectedPet = game?.pets[selectedPetIndex] || null;

  // ===== Actions =====

  const savePet = useCallback(async (updated: PetState) => {
    await window.petmiiAPI.savePet(updated);
    // Refresh game state
    const fresh = await window.petmiiAPI.loadGame();
    setGame(fresh);
  }, []);

  function handleHatch() {
    const generated = generateRandomPet();
    setPendingPet(generated);
    setView("hatching");
  }

  async function handleHatchAnimationEnd() {
    if (!pendingPet) return;

    const now = new Date().toISOString();
    const newPet: PetState = {
      id: crypto.randomUUID(),
      name: SPECIES_DEFAULT_NAMES[pendingPet.variant.species],
      species: pendingPet.variant.species,
      color: pendingPet.variant.color,
      personality: pendingPet.variant.personality,
      ...DEFAULT_PET_STATS,
      isShiny: pendingPet.isShiny,
      hatchedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await window.petmiiAPI.addPet(newPet);
      const fresh = await window.petmiiAPI.loadGame();
      setGame(fresh);
      setSelectedPetIndex(fresh.pets.length - 1);
      setView("pets");
    } catch (err) {
      console.error("[petmii] Failed to save pet:", err);
    }
  }

  async function handleEggHatch(eggId: string) {
    const egg = await window.petmiiAPI.hatchEgg(eggId);
    if (!egg) return;

    const generated = generateRandomPet();
    setPendingPet({
      variant: {
        species: egg.species,
        color: generated.variant.color,
        personality: generated.variant.personality,
        lifeStage: "baby",
      },
      isShiny: egg.isShiny,
    });
    setView("hatching");
  }

  async function handleDiscardEgg(eggId: string) {
    const confirmed = window.confirm(
      "Discard this egg? It will be lost forever.",
    );
    if (!confirmed) return;
    await window.petmiiAPI.hatchEgg(eggId); // removes egg from storage
    const fresh = await window.petmiiAPI.loadGame();
    setGame(fresh);
  }

  async function handleFeed() {
    if (!selectedPet) return;
    const updated = applyAction(selectedPet, "feed");
    await savePet(updated);
  }

  async function handlePlay() {
    if (!selectedPet || selectedPet.energy < 10) return;
    const updated = applyAction(selectedPet, "play");
    await savePet(updated);
  }

  async function handleClean() {
    if (!selectedPet) return;
    const updated = applyAction(selectedPet, "clean");
    await savePet(updated);
  }

  async function handleRest() {
    if (!selectedPet) return;
    const updated = applyAction(selectedPet, "rest");
    await savePet(updated);
  }

  async function handleRename(newName: string) {
    if (!selectedPet) return;
    const updated = {
      ...selectedPet,
      name: newName.trim(),
      updatedAt: new Date().toISOString(),
    };
    await savePet(updated);
    setShowRenameModal(false);
  }

  async function handleReset() {
    const confirmed = window.confirm(
      `Release ${selectedPet?.name}? This pet will be gone forever.`,
    );
    if (!confirmed) return;
    await window.petmiiAPI.removePet(selectedPet!.id);
    const fresh = await window.petmiiAPI.loadGame();
    setGame(fresh);
    setSelectedPetIndex(0);
    if (fresh.pets.length === 0 && fresh.eggs.length === 0) {
      setView("egg-ready");
    }
  }

  async function handleStartOver() {
    window.petmiiAPI.closeOverlay();
    await window.petmiiAPI.clearPet();
    const fresh = await window.petmiiAPI.loadGame();
    setGame(fresh);
    setLastDead(null);
    // Mercy egg should have been spawned by the decay engine
    if (fresh.eggs.length > 0) {
      setView("pets");
    } else {
      setView("egg-ready");
    }
  }

  function handlePrevPet() {
    if (!game || game.pets.length <= 1) return;
    setSelectedPetIndex((i) => (i - 1 + game.pets.length) % game.pets.length);
  }

  function handleNextPet() {
    if (!game || game.pets.length <= 1) return;
    setSelectedPetIndex((i) => (i + 1) % game.pets.length);
  }

  // ===== Render =====

  if (view === "loading" || !game) {
    return (
      <div className="egg-hatch-screen">
        <h1>petmii</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (view === "death" && lastDead) {
    return <DeathScreen petState={lastDead} onStartOver={handleStartOver} />;
  }

  if (view === "egg-ready") {
    return <EggHatchScreen onHatch={handleHatch} />;
  }

  if (view === "hatching") {
    return (
      <EggHatchScreen
        hatching
        onHatch={handleHatch}
        onAnimationEnd={handleHatchAnimationEnd}
      />
    );
  }

  // Main pets view
  return (
    <div className="app-container">
      {/* Tabs */}
      <div className="app-tabs">
        <button
          type="button"
          className={`app-tab ${activeTab === "pets" ? "app-tab-active" : ""}`}
          onClick={() => setActiveTab("pets")}
        >
          🐾 Pets
        </button>
        <button
          type="button"
          className={`app-tab ${activeTab === "eggs" ? "app-tab-active" : ""}`}
          onClick={() => setActiveTab("eggs")}
        >
          🥚 Eggs ({game.eggs.length})
        </button>
        <button
          type="button"
          className={`app-tab ${activeTab === "overlay" ? "app-tab-active" : ""}`}
          onClick={() => setActiveTab("overlay")}
        >
          👁 Overlay
        </button>
        <button
          type="button"
          className={`app-tab ${activeTab === "stats" ? "app-tab-active" : ""}`}
          onClick={() => setActiveTab("stats")}
        >
          📊
        </button>
      </div>

      {activeTab === "pets" && (
        <>
          {/* Pet navigation */}
          {game.pets.length > 1 && (
            <div className="pet-nav">
              <button
                type="button"
                onClick={handlePrevPet}
                className="pet-nav-btn"
              >
                ◀
              </button>
              <span className="pet-nav-label">
                {selectedPetIndex + 1} / {game.pets.length}
              </span>
              <button
                type="button"
                onClick={handleNextPet}
                className="pet-nav-btn"
              >
                ▶
              </button>
            </div>
          )}

          {selectedPet && (
            <>
              <PetDetails
                petState={selectedPet}
                onReset={handleReset}
                onRename={() => {
                  if (selectedPet.lifeStage === "adult")
                    setShowRenameModal(true);
                }}
                onFeed={handleFeed}
                onPlay={handlePlay}
                onClean={handleClean}
                onRest={handleRest}
              />
              {showRenameModal && (
                <RenamePetModal
                  currentName={selectedPet.name}
                  onRename={handleRename}
                  onClose={() => setShowRenameModal(false)}
                />
              )}
            </>
          )}

          {game.pets.length === 0 && (
            <div className="no-pets-message">
              <p>No pets yet. Check your eggs!</p>
              <button type="button" onClick={() => setActiveTab("eggs")}>
                View Eggs
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === "eggs" && (
        <EggList
          eggs={game.eggs}
          onHatch={handleEggHatch}
          onDiscard={handleDiscardEgg}
          pets={game.pets}
        />
      )}

      {activeTab === "overlay" && (
        <div className="overlay-tab">
          <button
            type="button"
            className={`overlay-toggle-btn ${overlayOn ? "overlay-toggle-on" : ""}`}
            onClick={() => {
              window.petmiiAPI.enterOverlayMode();
              setOverlayOn((prev) => !prev);
            }}
          >
            {overlayOn ? "🟢 Overlay: ON" : "⚫ Overlay: OFF"}
          </button>

          <h4>Pets in Overlay (max 4)</h4>
          <div className="overlay-selection-list">
            {game.pets.map((p) => {
              const isInOverlay = game.settings.overlayPets.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={`overlay-selection-item ${overlayOn ? "disabled" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isInOverlay}
                    disabled={overlayOn}
                    onChange={async () => {
                      if (overlayOn) return;
                      let newIds: string[];
                      if (isInOverlay) {
                        newIds = game.settings.overlayPets.filter(
                          (id) => id !== p.id,
                        );
                      } else {
                        if (game.settings.overlayPets.length >= 4) {
                          window.alert(
                            "Maximum 4 pets can be shown in overlay mode.",
                          );
                          return;
                        }
                        newIds = [...game.settings.overlayPets, p.id];
                      }
                      await window.petmiiAPI.setOverlayPets(newIds);
                      const fresh = await window.petmiiAPI.loadGame();
                      setGame(fresh);
                    }}
                  />
                  <span>
                    {p.name} ({p.species})
                  </span>
                </label>
              );
            })}
          </div>
          {overlayOn && (
            <p className="overlay-tab-note">
              Turn off overlay to change selection
            </p>
          )}
        </div>
      )}

      {activeTab === "stats" && (
        <div className="stats-tab">
          <ResourceMonitor />
        </div>
      )}
    </div>
  );
}

// ===== Action helpers =====

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function applyAction(
  pet: PetState,
  action: "feed" | "play" | "clean" | "rest",
): PetState {
  const now = new Date().toISOString();
  const AMOUNT = 20;
  const BOND = 2;

  switch (action) {
    case "feed":
      return {
        ...pet,
        hunger: clamp(pet.hunger + AMOUNT),
        energy: clamp(pet.energy + 5),
        bond: clamp(pet.bond + BOND),
        lastFedAt: now,
        updatedAt: now,
      };
    case "play":
      return {
        ...pet,
        happiness: clamp(pet.happiness + AMOUNT),
        energy: clamp(pet.energy - 10),
        hunger: clamp(pet.hunger - 5),
        bond: clamp(pet.bond + BOND),
        lastPlayedAt: now,
        updatedAt: now,
      };
    case "clean":
      return {
        ...pet,
        cleanliness: clamp(pet.cleanliness + 25),
        happiness: clamp(pet.happiness + 5),
        bond: clamp(pet.bond + BOND),
        lastCleanedAt: now,
        updatedAt: now,
      };
    case "rest":
      return {
        ...pet,
        energy: clamp(pet.energy + 25),
        hunger: clamp(pet.hunger - 5),
        bond: clamp(pet.bond + BOND),
        lastRestedAt: now,
        updatedAt: now,
      };
  }
}
