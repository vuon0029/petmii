import { useState } from "react";
import { useOnboarding } from "./hooks/useOnboarding";
import { usePetState } from "./hooks/usePetState";
import { generateRandomPetVariant } from "./pet/generateRandomPet";
import { DEFAULT_PET_STATS, PetState } from "./pet/petVariant";
import { EggHatchScreen } from "./components/EggHatchScreen";
import { NamePetScreen } from "./components/NamePetScreen";
import { PetDetails } from "./components/PetDetails";
import { RenamePetModal } from "./components/RenamePetModal";

export function App() {
  const {
    state,
    loading,
    petVariant,
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

  // Show nothing while loading initial state from storage
  if (loading) {
    return (
      <div className="egg-hatch-screen">
        <h1>petmii</h1>
        <p>Loading...</p>
      </div>
    );
  }

  function handleHatch() {
    const variant = generateRandomPetVariant();
    setPetVariant(variant);
    transition("HATCHING");
  }

  function handleAnimationEnd() {
    transition("NAMING");
  }

  async function handleNameSubmit(name: string) {
    if (!petVariant) return;

    const now = new Date().toISOString();
    const newPet: PetState = {
      id: crypto.randomUUID(),
      name,
      species: petVariant.species,
      color: petVariant.color,
      personality: petVariant.personality,
      ...DEFAULT_PET_STATS,
      hatchedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    try {
      console.log("[petmii] Saving new pet:", newPet.name);
      await window.petmiiAPI.savePet(newPet);
      console.log("[petmii] Pet saved successfully");
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

  function handleRenameClick(_currentName: string) {
    setShowRenameModal(true);
  }

  async function handleRenameConfirm(newName: string) {
    try {
      console.log("[petmii] Renaming pet to:", newName);
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
    case "NAMING":
      return (
        <NamePetScreen variant={petVariant!} onNameSubmit={handleNameSubmit} />
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
