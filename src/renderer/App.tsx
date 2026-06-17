import { useState, useEffect } from "react";
import { useOnboarding } from "./hooks/useOnboarding";
import { usePetState } from "./hooks/usePetState";
import { generateRandomPet } from "./pet/generateRandomPet";
import { DEFAULT_PET_STATS, PetState, SPECIES_DEFAULT_NAMES } from "./pet/petVariant";
import { EggHatchScreen } from "./components/EggHatchScreen";
import { PetDetails } from "./components/PetDetails";
import { RenamePetModal } from "./components/RenamePetModal";
import { DeathScreen } from "./components/DeathScreen";

export function App() {
  const {
    state,
    loading,
    petState,
    transition,
    setPetVariant,
    setPetState,
  } = useOnboarding();

  const { feed, play, clean, rest, rename, reset } = usePetState(
    petState,
    setPetState
  );

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [pendingPet, setPendingPet] = useState<{ variant: ReturnType<typeof generateRandomPet>["variant"]; isShiny: boolean } | null>(null);

  // Listen for real-time state updates from the decay engine
  useEffect(() => {
    window.petmiiAPI.onStateUpdate((updatedPet) => {
      if (updatedPet && petState && updatedPet.id === petState.id) {
        setPetState(updatedPet);
      }
    });
  }, [petState?.id]);

  // Listen for death events
  useEffect(() => {
    window.petmiiAPI.onPetDied(() => {
      // petState will be updated via onStateUpdate
    });
  }, []);

  if (loading) {
    return (
      <div className="egg-hatch-screen">
        <h1>petmii</h1>
        <p>Loading...</p>
      </div>
    );
  }

  // Check if pet is dead — show death screen
  if (petState && !petState.isAlive) {
    return (
      <DeathScreen
        petState={petState}
        onStartOver={async () => {
          window.petmiiAPI.closeOverlay();
          await reset();
          transition("EGG_READY");
        }}
      />
    );
  }

  function handleHatch() {
    const generated = generateRandomPet();
    setPetVariant(generated.variant);
    setPendingPet(generated);
    transition("HATCHING");
  }

  async function handleAnimationEnd() {
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
      await window.petmiiAPI.savePet(newPet);
      setPetState(newPet);
      transition("ACTIVE_PET");
    } catch (err) {
      console.error("[petmii] Failed to save pet:", err);
    }
  }

  async function handleReset() {
    const confirmed = window.confirm(
      "Are you sure you want to reset your pet? This cannot be undone."
    );
    if (!confirmed) return;

    window.petmiiAPI.closeOverlay();
    await reset();
    transition("EGG_READY");
  }

  function handleRenameClick() {
    // Only allow renaming at adult stage
    if (petState && petState.lifeStage === "adult") {
      setShowRenameModal(true);
    }
  }

  async function handleRenameConfirm(newName: string) {
    try {
      const updated = await rename(newName);
      if (updated) {
        window.petmiiAPI.updateOverlay({
          species: updated.species,
          color: updated.color,
          personality: updated.personality,
        });
      }
      setShowRenameModal(false);
    } catch (err) {
      console.error("[petmii] Failed to rename pet:", err);
    }
  }

  switch (state) {
    case "EGG_READY":
      return <EggHatchScreen onHatch={handleHatch} />;
    case "HATCHING":
      return (
        <EggHatchScreen
          hatching
          onHatch={handleHatch}
          onAnimationEnd={handleAnimationEnd}
        />
      );
    case "ACTIVE_PET":
      return (
        <>
          <PetDetails
            petState={petState!}
            onReset={handleReset}
            onRename={handleRenameClick}
            onFeed={feed}
            onPlay={play}
            onClean={clean}
            onRest={rest}
            onOverlayMode={() => window.petmiiAPI.enterOverlayMode()}
          />
          {showRenameModal && (
            <RenamePetModal
              currentName={petState!.name}
              onRename={handleRenameConfirm}
              onClose={() => setShowRenameModal(false)}
            />
          )}
        </>
      );
    default:
      return <EggHatchScreen onHatch={handleHatch} />;
  }
}
