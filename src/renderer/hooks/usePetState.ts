import { useCallback } from "react";
import { PetState } from "../pet/petVariant";

/**
 * Hook providing pet rename and reset actions.
 * Care actions (feed, play, clean, rest) are handled by usePetActions via Main Process IPC.
 */
export function usePetState(
  petState: PetState | null,
  setPetState: (state: PetState | null) => void
) {
  const rename = useCallback(
    async (newName: string): Promise<PetState | null> => {
      if (!petState) return null;

      const trimmed = newName.trim();
      if (trimmed.length === 0) throw new Error("Name cannot be empty");
      if (trimmed.length > 20) throw new Error("Name must be 20 characters or fewer");

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

  const reset = useCallback(async (): Promise<null> => {
    await window.petmiiAPI.clearPet();
    setPetState(null);
    return null;
  }, [setPetState]);

  return { rename, reset };
}
