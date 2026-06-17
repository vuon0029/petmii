import { useCallback } from "react";
import { PetState } from "../pet/petVariant";
import { PERSONALITY_TRAITS } from "../pet/personalityTraits";

/**
 * Hook providing pet care actions with soft cooldowns and secondary effects.
 */
export function usePetState(
  petState: PetState | null,
  setPetState: (state: PetState | null) => void
) {
  // Full effect amounts
  const FEED_AMOUNT = 20;
  const PLAY_AMOUNT = 20;
  const CLEAN_AMOUNT = 25;
  const REST_AMOUNT = 25;
  const BOND_PER_ACTION = 2;

  // Cooldown durations (ms)
  const COOLDOWNS = {
    feed: 5 * 60 * 1000,   // 5 min
    play: 10 * 60 * 1000,  // 10 min
    clean: 15 * 60 * 1000, // 15 min
    rest: 20 * 60 * 1000,  // 20 min
  };

  // Soft penalty: 40% effect during cooldown
  const COOLDOWN_PENALTY = 0.4;

  function clamp(value: number, min = 0, max = 100): number {
    return Math.min(max, Math.max(min, value));
  }

  function isOnCooldown(lastActionAt: string | null, cooldownMs: number): boolean {
    if (!lastActionAt) return false;
    return Date.now() - new Date(lastActionAt).getTime() < cooldownMs;
  }

  function getEffectMultiplier(lastActionAt: string | null, cooldownMs: number): number {
    return isOnCooldown(lastActionAt, cooldownMs) ? COOLDOWN_PENALTY : 1.0;
  }

  function getBondGain(pet: PetState): number {
    const personalityMod = PERSONALITY_TRAITS[pet.personality].bondGainMultiplier;
    return BOND_PER_ACTION * personalityMod;
  }

  const feed = useCallback(async (): Promise<PetState | null> => {
    if (!petState || !petState.isAlive) return null;

    const now = new Date().toISOString();
    const multiplier = getEffectMultiplier(petState.lastFedAt, COOLDOWNS.feed);
    const amount = Math.round(FEED_AMOUNT * multiplier);

    const updated: PetState = {
      ...petState,
      hunger: clamp(petState.hunger + amount),
      energy: clamp(petState.energy + Math.round(5 * multiplier)),
      bond: clamp(petState.bond + getBondGain(petState)),
      lastFedAt: now,
      updatedAt: now,
    };

    await window.petmiiAPI.savePet(updated);
    setPetState(updated);
    return updated;
  }, [petState, setPetState]);

  const play = useCallback(async (): Promise<PetState | null> => {
    if (!petState || !petState.isAlive) return null;

    // Can't play if energy is too low
    if (petState.energy < 10) return petState;

    const now = new Date().toISOString();
    const multiplier = getEffectMultiplier(petState.lastPlayedAt, COOLDOWNS.play);
    const amount = Math.round(PLAY_AMOUNT * multiplier);

    const updated: PetState = {
      ...petState,
      happiness: clamp(petState.happiness + amount),
      energy: clamp(petState.energy - Math.round(10 * multiplier)),
      hunger: clamp(petState.hunger - Math.round(5 * multiplier)),
      bond: clamp(petState.bond + getBondGain(petState)),
      lastPlayedAt: now,
      updatedAt: now,
    };

    await window.petmiiAPI.savePet(updated);
    setPetState(updated);
    return updated;
  }, [petState, setPetState]);

  const clean = useCallback(async (): Promise<PetState | null> => {
    if (!petState || !petState.isAlive) return null;

    const now = new Date().toISOString();
    const multiplier = getEffectMultiplier(petState.lastCleanedAt, COOLDOWNS.clean);
    const amount = Math.round(CLEAN_AMOUNT * multiplier);

    const updated: PetState = {
      ...petState,
      cleanliness: clamp(petState.cleanliness + amount),
      happiness: clamp(petState.happiness + Math.round(5 * multiplier)),
      bond: clamp(petState.bond + getBondGain(petState)),
      lastCleanedAt: now,
      updatedAt: now,
    };

    await window.petmiiAPI.savePet(updated);
    setPetState(updated);
    return updated;
  }, [petState, setPetState]);

  const rest = useCallback(async (): Promise<PetState | null> => {
    if (!petState || !petState.isAlive) return null;

    const now = new Date().toISOString();
    const multiplier = getEffectMultiplier(petState.lastRestedAt, COOLDOWNS.rest);
    const amount = Math.round(REST_AMOUNT * multiplier);

    const updated: PetState = {
      ...petState,
      energy: clamp(petState.energy + amount),
      hunger: clamp(petState.hunger - Math.round(5 * multiplier)),
      bond: clamp(petState.bond + getBondGain(petState)),
      lastRestedAt: now,
      updatedAt: now,
    };

    await window.petmiiAPI.savePet(updated);
    setPetState(updated);
    return updated;
  }, [petState, setPetState]);

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

  return { feed, play, clean, rest, rename, reset };
}
