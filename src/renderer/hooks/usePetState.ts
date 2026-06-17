import { useCallback } from "react";
import { PetState } from "../pet/petVariant";

/**
 * Hook providing pet care actions (feed, play, clean, rest, rename, reset).
 *
 * Each action updates the relevant stat, sets updatedAt, persists via IPC,
 * and updates the local state through setPetState.
 *
 * @param petState - The current PetState (or null if no pet)
 * @param setPetState - Callback to update the local PetState
 */
export function usePetState(
  petState: PetState | null,
  setPetState: (state: PetState | null) => void
) {
  const STAT_INCREMENT = 15;

  /**
   * Clamps a value between 0 and 100.
   */
  function clamp(value: number, min = 0, max = 100): number {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Feed the pet: increases hunger stat by STAT_INCREMENT, clamped to 100.
   */
  const feed = useCallback(async (): Promise<PetState | null> => {
    if (!petState) return null;

    const now = new Date().toISOString();
    const updated: PetState = {
      ...petState,
      hunger: clamp(petState.hunger + STAT_INCREMENT),
      lastFedAt: now,
      updatedAt: now,
    };

    await window.petmiiAPI.savePet(updated);
    setPetState(updated);
    return updated;
  }, [petState, setPetState]);

  /**
   * Play with the pet: increases happiness stat by STAT_INCREMENT, clamped to 100.
   */
  const play = useCallback(async (): Promise<PetState | null> => {
    if (!petState) return null;

    const now = new Date().toISOString();
    const updated: PetState = {
      ...petState,
      happiness: clamp(petState.happiness + STAT_INCREMENT),
      lastPlayedAt: now,
      updatedAt: now,
    };

    await window.petmiiAPI.savePet(updated);
    setPetState(updated);
    return updated;
  }, [petState, setPetState]);

  /**
   * Clean the pet: increases cleanliness stat by STAT_INCREMENT, clamped to 100.
   */
  const clean = useCallback(async (): Promise<PetState | null> => {
    if (!petState) return null;

    const now = new Date().toISOString();
    const updated: PetState = {
      ...petState,
      cleanliness: clamp(petState.cleanliness + STAT_INCREMENT),
      lastCleanedAt: now,
      updatedAt: now,
    };

    await window.petmiiAPI.savePet(updated);
    setPetState(updated);
    return updated;
  }, [petState, setPetState]);

  /**
   * Rest the pet: increases energy stat by STAT_INCREMENT, clamped to 100.
   */
  const rest = useCallback(async (): Promise<PetState | null> => {
    if (!petState) return null;

    const now = new Date().toISOString();
    const updated: PetState = {
      ...petState,
      energy: clamp(petState.energy + STAT_INCREMENT),
      lastRestedAt: now,
      updatedAt: now,
    };

    await window.petmiiAPI.savePet(updated);
    setPetState(updated);
    return updated;
  }, [petState, setPetState]);

  /**
   * Rename the pet.
   * Validates: non-empty, ≤20 characters after trimming.
   * Throws an error if validation fails.
   */
  const rename = useCallback(
    async (newName: string): Promise<PetState | null> => {
      if (!petState) return null;

      const trimmed = newName.trim();

      if (trimmed.length === 0) {
        throw new Error("Name cannot be empty");
      }

      if (trimmed.length > 20) {
        throw new Error("Name must be 20 characters or fewer");
      }

      const now = new Date().toISOString();
      const updated: PetState = {
        ...petState,
        name: trimmed,
        updatedAt: now,
      };

      await window.petmiiAPI.savePet(updated);
      setPetState(updated);
      return updated;
    },
    [petState, setPetState]
  );

  /**
   * Reset the pet: clears storage and returns null.
   */
  const reset = useCallback(async (): Promise<null> => {
    await window.petmiiAPI.clearPet();
    setPetState(null);
    return null;
  }, [setPetState]);

  return { feed, play, clean, rest, rename, reset };
}
