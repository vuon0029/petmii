// src/renderer/hooks/usePetActions.ts
// Hook that dispatches user actions via IPC to the main process.
// The renderer does NOT optimistically mutate pet stats — it waits for the
// authoritative game:state-update broadcast from the main process on success.

import { useCallback } from 'react';
import type { UserActionType } from '../../shared/pet/actionTypes';
import type { PetActionAvailability } from '../../main/actionValidator';

/**
 * Hook that dispatches user actions via IPC to the main process.
 * Returns the structured PetActionAvailability result.
 *
 * Renderer rules:
 * - Does NOT optimistically mutate pet stats before Main Process confirms
 * - Handles rejected results gracefully (no error toasts — disabled state IS feedback)
 * - Waits for authoritative game:state-update broadcast on success for state refresh
 */
export function usePetActions(petId: string | null): {
  performAction: (action: UserActionType) => Promise<PetActionAvailability>;
} {
  const performAction = useCallback(
    async (action: UserActionType): Promise<PetActionAvailability> => {
      if (petId === null) {
        return { available: false, message: 'No pet selected' };
      }

      const result: PetActionAvailability = await window.petmiiAPI.performAction({
        petId,
        action,
      });

      return result;
    },
    [petId]
  );

  return { performAction };
}
