import { useState, useEffect, useCallback, useRef } from "react";
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
import { usePetActions } from './hooks/usePetActions';
import { useCooldownState } from './hooks/useCooldownState';
import type { UserActionType } from '../shared/pet/actionTypes';
import type { GameState } from "./types";

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
    "pets" | "eggs" | "overlay" | "settings" | "stats"
  >("pets");
  const [overlayOn, setOverlayOn] = useState(false);
  const [isRestingInOverlay, setIsRestingInOverlay] = useState(false);
  const [isAutonomousActionActive, setIsAutonomousActionActive] = useState(false);
  const [autonomousActionName, setAutonomousActionName] = useState<string | null>(null);
  const [autonomousCountdown, setAutonomousCountdown] = useState<number | null>(null);
  const autonomousEndTimeRef = useRef<number | null>(null);
  // Per-pet autonomous action tracking (petId → { action, endTime })
  const autonomousActionsRef = useRef<Map<string, { action: string; endTime: number }>>(new Map());
  const [evolvingPetId, setEvolvingPetId] = useState<string | null>(null);
  const [evolutionReveal, setEvolutionReveal] = useState<{ petName: string; newStage: string; adultTrait: string | null } | null>(null);

  // Load game state on mount
  useEffect(() => {
    async function init() {
      const loaded = await window.petmiiAPI.loadGame();
      setGame(loaded);

      // Sync overlay toggle with actual state
      const overlayVisible = await window.petmiiAPI.isOverlayVisible();
      setOverlayOn(overlayVisible);

      // Sync rest button state with main process (survives window remount)
      if (loaded.pets.length > 0 && overlayVisible) {
        const selectedId = loaded.pets[0]?.id;
        if (selectedId) {
          const resting = await window.petmiiAPI.isRestingInOverlay(selectedId);
          setIsRestingInOverlay(resting);
        }
      }

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

    window.petmiiAPI.onRestEnded(() => {
      setIsRestingInOverlay(false);
    });

    window.petmiiAPI.onAutonomousActionStarted((data) => {
      // Track per-pet regardless of selection
      if (data.durationMs) {
        autonomousActionsRef.current.set(data.petId, {
          action: data.action,
          endTime: Date.now() + data.durationMs,
        });
      } else {
        autonomousActionsRef.current.set(data.petId, {
          action: data.action,
          endTime: Date.now() + 45000, // fallback estimate
        });
      }

      setGame((currentGame) => {
        setSelectedPetIndex((idx) => {
          if (currentGame?.pets[idx]?.id === data.petId) {
            setIsAutonomousActionActive(true);
            setAutonomousActionName(data.action);
            if (data.durationMs) {
              autonomousEndTimeRef.current = Date.now() + data.durationMs;
              setAutonomousCountdown(Math.ceil(data.durationMs / 1000));
            }
          }
          return idx;
        });
        return currentGame;
      });
    });
    window.petmiiAPI.onAutonomousActionEnded((data) => {
      // Clear per-pet tracking
      autonomousActionsRef.current.delete(data.petId);

      setGame((currentGame) => {
        setSelectedPetIndex((idx) => {
          if (currentGame?.pets[idx]?.id === data.petId) {
            setIsAutonomousActionActive(false);
            setAutonomousActionName(null);
            autonomousEndTimeRef.current = null;
            setAutonomousCountdown(null);
          }
          return idx;
        });
        return currentGame;
      });
    });

    window.petmiiAPI.onEvolveComplete((data) => {
      const { petId, newStage, adultTrait } = data;
      setEvolvingPetId(null);
      // Find pet name from current game state
      setGame((currentGame) => {
        const pet = currentGame?.pets.find(p => p.id === petId);
        const petName = pet?.name || "Your pet";
        setEvolutionReveal({ petName, newStage, adultTrait });
        return currentGame;
      });
    });

    window.petmiiAPI.onEvolveRejected(() => {
      setEvolvingPetId(null);
    });
  }, []);

  // Selected pet from game state
  const selectedPet = game?.pets[selectedPetIndex] || null;

  // New cooldown system hooks
  const { performAction } = usePetActions(selectedPet?.id ?? null);
  const isBusy = isRestingInOverlay || isAutonomousActionActive || evolvingPetId === selectedPet?.id;
  const autonomousActionInfo = (isAutonomousActionActive && autonomousActionName && autonomousEndTimeRef.current)
    ? { action: autonomousActionName, endTime: autonomousEndTimeRef.current }
    : null;
  const buttonStates = useCooldownState(selectedPet, isBusy, autonomousActionInfo);

  // Sync rest button when selected pet changes
  useEffect(() => {
    if (!selectedPet || !overlayOn) {
      setIsRestingInOverlay(false);
      setIsAutonomousActionActive(false);
      setAutonomousActionName(null);
      autonomousEndTimeRef.current = null;
      setAutonomousCountdown(null);
      return;
    }
    window.petmiiAPI.isRestingInOverlay(selectedPet.id).then(setIsRestingInOverlay);

    // Check per-pet tracking first (has action name + end time)
    const tracked = autonomousActionsRef.current.get(selectedPet.id);
    if (tracked) {
      setIsAutonomousActionActive(true);
      setAutonomousActionName(tracked.action);
      autonomousEndTimeRef.current = tracked.endTime;
      const remaining = Math.max(0, Math.ceil((tracked.endTime - Date.now()) / 1000));
      setAutonomousCountdown(remaining);
    } else {
      // Query main process for action info (works even if App opened after action started)
      window.petmiiAPI.getAutonomousActionInfo(selectedPet.id).then((info) => {
        if (info && info.remainingMs > 0) {
          setIsAutonomousActionActive(true);
          setAutonomousActionName(info.action);
          autonomousEndTimeRef.current = Date.now() + info.remainingMs;
          setAutonomousCountdown(Math.ceil(info.remainingMs / 1000));
        } else {
          setIsAutonomousActionActive(false);
          setAutonomousActionName(null);
          autonomousEndTimeRef.current = null;
          setAutonomousCountdown(null);
        }
      });
    }
  }, [selectedPetIndex, selectedPet?.id, overlayOn]);

  // Countdown timer for autonomous actions
  useEffect(() => {
    if (!autonomousEndTimeRef.current) return;

    const interval = setInterval(() => {
      const endTime = autonomousEndTimeRef.current;
      if (!endTime) {
        setAutonomousCountdown(null);
        clearInterval(interval);
        return;
      }
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setAutonomousCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [autonomousEndTimeRef.current]);

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
      // If overlay is on, ensure the new pet is in overlay pets list
      if (overlayOn) {
        const currentOverlayPets = await window.petmiiAPI.getOverlayPets();
        if (!currentOverlayPets.includes(newPet.id)) {
          await window.petmiiAPI.setOverlayPets([...currentOverlayPets, newPet.id]);
        }
      }
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
        color: egg.isShiny ? "shiny" : generated.variant.color,
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

  const handleAction = useCallback(async (action: UserActionType) => {
    if (!selectedPet) return;
    // Special handling for rest when overlay is on (still needs overlay animation)
    if (action === 'rest' && overlayOn && !isRestingInOverlay && !isAutonomousActionActive) {
      window.petmiiAPI.startOverlayRest({ petId: selectedPet.id });
      setIsRestingInOverlay(true);
      return;
    }
    await performAction(action);
  }, [selectedPet, overlayOn, isRestingInOverlay, isAutonomousActionActive, performAction]);

  function handleEvolve() {
    if (!selectedPet || evolvingPetId === selectedPet.id) return;
    const sessionId = crypto.randomUUID();
    setEvolvingPetId(selectedPet.id);
    window.petmiiAPI.evolveStart({ petId: selectedPet.id, sessionId });
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
          onClick={() => { setActiveTab("eggs"); window.petmiiAPI.clearEggNotifications(); }}
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
          className={`app-tab ${activeTab === "settings" ? "app-tab-active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          ⚙ Settings
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
                onAction={handleAction}
                onEvolve={handleEvolve}
                buttonStates={buttonStates}
                evolving={evolvingPetId === selectedPet.id}
                isResting={isRestingInOverlay || (isAutonomousActionActive && autonomousActionName === "autonomousRest")}
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
              <button type="button" onClick={() => { setActiveTab("eggs"); window.petmiiAPI.clearEggNotifications(); }}>
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
          onGameUpdate={setGame}
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
                      // Deduplicate and filter to only IDs present in game.pets
                      const gamePetIds = new Set(game.pets.map(pet => pet.id));
                      const activeOverlayPets = [...new Set(game.settings.overlayPets)].filter(id => gamePetIds.has(id));
                      let newIds: string[];
                      if (isInOverlay) {
                        newIds = activeOverlayPets.filter(
                          (id) => id !== p.id,
                        );
                      } else {
                        if (activeOverlayPets.length >= 4) {
                          window.alert(
                            "Maximum 4 pets can be shown in overlay mode.",
                          );
                          return;
                        }
                        newIds = [...activeOverlayPets, p.id];
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

      {activeTab === "settings" && game && (
        <SettingsTab game={game} onGameUpdate={setGame} overlayOn={overlayOn} />
      )}

      {activeTab === "stats" && (
        <div className="stats-tab">
          <ResourceMonitor />
        </div>
      )}

      {evolutionReveal && (
        <div className="evolution-reveal" onClick={() => setEvolutionReveal(null)}>
          <p className="evolution-reveal-title">
            {getRevealTitle(evolutionReveal)}
          </p>
          <p className="evolution-reveal-body">
            {getRevealBody(evolutionReveal)}
          </p>
          <span className="evolution-reveal-dismiss">tap to dismiss</span>
        </div>
      )}
    </div>
  );
}

// ===== Settings Tab =====

function SettingsTab({ game, onGameUpdate, overlayOn }: { game: GameState; onGameUpdate: (g: GameState) => void; overlayOn: boolean }) {
  const petScale = game.settings.petScale ?? 1.5;

  async function handleScaleChange(newScale: number) {
    if (overlayOn) return;
    const updated: GameState = {
      ...game,
      settings: { ...game.settings, petScale: newScale },
    };
    await window.petmiiAPI.saveGame(updated);
    onGameUpdate(updated);
  }

  return (
    <div className="settings-tab">
      <h3>Settings</h3>
      <div className="settings-item">
        <label className="settings-label" htmlFor="pet-scale-slider">
          Pet Size (Overlay)
        </label>
        <div className="settings-slider-row">
          <input
            id="pet-scale-slider"
            type="range"
            min="0.5"
            max="3"
            step="0.25"
            value={petScale}
            disabled={overlayOn}
            onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
          />
          <span className="settings-value">{petScale.toFixed(2)}x</span>
        </div>
        {overlayOn && (
          <p className="settings-note">Turn off overlay to change pet size</p>
        )}
      </div>
    </div>
  );
}

// ===== Evolution reveal helpers =====

function getRevealTitle(reveal: { petName: string; newStage: string; adultTrait: string | null }): string {
  if (reveal.newStage === "child") {
    return `${reveal.petName} evolved into a Child!`;
  }
  if (reveal.adultTrait) {
    return `${reveal.petName} grew into a ${reveal.adultTrait} Adult!`;
  }
  return `${reveal.petName} grew into an Adult!`;
}

function getRevealBody(reveal: { petName: string; newStage: string; adultTrait: string | null }): string {
  if (reveal.newStage === "child") {
    return "They look a little more confident now.";
  }
  switch (reveal.adultTrait) {
    case "Playful": return `All that playtime made ${reveal.petName} bold, bouncy, and full of energy.`;
    case "Affectionate": return `All that closeness made ${reveal.petName} warm, gentle, and loving.`;
    case "Sleepy": return `All those cozy naps made ${reveal.petName} calm, peaceful, and content.`;
    case "Chaotic": return `All those wild flights made ${reveal.petName} fearless and full of surprises.`;
    case "Classic": return `Steady, familiar, and easygoing — a timeless little friend.`;
    default: return "A wonderful transformation!";
  }
}

