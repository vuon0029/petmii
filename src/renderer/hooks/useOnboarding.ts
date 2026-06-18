import { useState, useEffect } from "react";
import { AppOnboardingState, isValidTransition } from "../pet/onboarding";
import { PetVariant, PetState } from "../pet/petVariant";

/**
 * Hook managing onboarding state machine for petmii.
 *
 * On mount, checks Pet_Storage via IPC:
 * - If a valid PetState exists → sets state to ACTIVE_PET
 * - Otherwise → sets state to EGG_READY
 *
 * Exposes a transition function that enforces valid state transitions.
 */
export function useOnboarding() {
  const [state, setState] = useState<AppOnboardingState>("EGG_READY");
  const [petVariant, setPetVariant] = useState<PetVariant | null>(null);
  const [petState, setPetState] = useState<PetState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: check storage for existing pet
  useEffect(() => {
    async function init() {
      try {
        const saved = await window.petmiiAPI.loadPet();
        if (saved && saved.isAlive) {
          setPetState(saved);
          setPetVariant({
            species: saved.species,
            color: saved.color,
            personality: saved.personality,
          });
          setState("ACTIVE_PET");
        } else {
          // No pet, or dead pet — clear any leftover data and start fresh
          if (saved && !saved.isAlive) {
            await window.petmiiAPI.clearPet();
          }
          setState("EGG_READY");
        }
      } catch (err) {
        // Storage inaccessible or corrupted — default to EGG_READY
        setState("EGG_READY");
        setError(
          err instanceof Error ? err.message : "Failed to load pet data"
        );
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  /**
   * Attempts to transition to the target state.
   * Returns true if the transition was valid and applied, false otherwise.
   */
  function transition(target: AppOnboardingState): boolean {
    if (!isValidTransition(state, target)) {
      return false;
    }
    setState(target);
    return true;
  }

  return {
    state,
    loading,
    petVariant,
    petState,
    error,
    transition,
    setPetVariant,
    setPetState,
    setError,
  };
}
