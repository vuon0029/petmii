import { describe, it, expect } from 'vitest';
import {
  getPetActionAvailability,
  applyUserAction,
  clamp,
} from './actionValidator';
import { ACTION_COOLDOWN_MAP } from '../shared/pet/actionCooldownConstants';
import { createDefaultCareHistory } from '../shared/pet/careHistory';
import type { PetState } from '../renderer/pet/petVariant';
import type { UserActionType } from '../shared/pet/actionTypes';

// --- Helper: builds a test PetState with sensible defaults ---

function buildTestPet(overrides: Partial<PetState> = {}): PetState {
  const now = new Date().toISOString();
  return {
    id: 'test-pet-1',
    name: 'TestPet',
    species: 'blob',
    color: 'yellow',
    personality: 'sweet',
    isShiny: false,
    hunger: 50,
    happiness: 50,
    energy: 50,
    cleanliness: 50,
    bond: 50,
    hp: 100,
    isAlive: true,
    mood: 'happy',
    lifeStage: 'baby',
    lastMessage: 'Hello!',
    lastFedAt: null,
    lastPlayedAt: null,
    lastCleanedAt: null,
    lastRestedAt: null,
    hatchedAt: now,
    diedAt: null,
    createdAt: now,
    updatedAt: now,
    careHistory: createDefaultCareHistory(),
    actionCooldowns: {},
    ...overrides,
  };
}

// --- getPetActionAvailability ---

describe('getPetActionAvailability', () => {
  describe('Rejection invariant (purity)', () => {
    it('does not mutate the pet object when returning PET_BUSY', () => {
      const pet = buildTestPet({
        hunger: 80,
        actionCooldowns: { feed: Date.now() + 60000 },
      });
      const original = JSON.parse(JSON.stringify(pet));

      const result = getPetActionAvailability(pet, 'feed', true);

      expect(result.available).toBe(false);
      expect(result.reasonCode).toBe('PET_BUSY');
      expect(JSON.parse(JSON.stringify(pet))).toEqual(original);
    });
  });

  describe('Display priority ordering', () => {
    const now = Date.now();

    it('isBusy=true + active cooldown + stat maxed → returns PET_BUSY', () => {
      const pet = buildTestPet({
        hunger: 100,
        actionCooldowns: { feed: now + 60000 },
      });

      const result = getPetActionAvailability(pet, 'feed', true, now);

      expect(result.available).toBe(false);
      expect(result.reasonCode).toBe('PET_BUSY');
    });

    it('isBusy=false + active cooldown + stat maxed → returns ACTION_ON_COOLDOWN', () => {
      const pet = buildTestPet({
        hunger: 100,
        actionCooldowns: { feed: now + 60000 },
      });

      const result = getPetActionAvailability(pet, 'feed', false, now);

      expect(result.available).toBe(false);
      expect(result.reasonCode).toBe('ACTION_ON_COOLDOWN');
    });

    it('isBusy=false + no cooldown + stat maxed → returns STAT_ALREADY_MAXED', () => {
      const pet = buildTestPet({
        hunger: 100,
        actionCooldowns: {},
      });

      const result = getPetActionAvailability(pet, 'feed', false, now);

      expect(result.available).toBe(false);
      expect(result.reasonCode).toBe('STAT_ALREADY_MAXED');
    });

    it('isBusy=false + no cooldown + stat not maxed → returns { available: true }', () => {
      const pet = buildTestPet({
        hunger: 50,
        actionCooldowns: {},
      });

      const result = getPetActionAvailability(pet, 'feed', false, now);

      expect(result.available).toBe(true);
      expect(result.reasonCode).toBeUndefined();
    });
  });

  describe('Stat-action mapping correctness', () => {
    const now = Date.now();

    it('hunger=100, other stats<100 → feed rejected, play/clean/rest available', () => {
      const pet = buildTestPet({
        hunger: 100,
        happiness: 50,
        energy: 50,
        cleanliness: 50,
        actionCooldowns: {},
      });

      expect(getPetActionAvailability(pet, 'feed', false, now).reasonCode).toBe('STAT_ALREADY_MAXED');
      expect(getPetActionAvailability(pet, 'play', false, now).available).toBe(true);
      expect(getPetActionAvailability(pet, 'clean', false, now).available).toBe(true);
      expect(getPetActionAvailability(pet, 'rest', false, now).available).toBe(true);
    });

    it('happiness=100, other stats<100 → play rejected, feed/clean/rest available', () => {
      const pet = buildTestPet({
        hunger: 50,
        happiness: 100,
        energy: 50,
        cleanliness: 50,
        actionCooldowns: {},
      });

      expect(getPetActionAvailability(pet, 'play', false, now).reasonCode).toBe('STAT_ALREADY_MAXED');
      expect(getPetActionAvailability(pet, 'feed', false, now).available).toBe(true);
      expect(getPetActionAvailability(pet, 'clean', false, now).available).toBe(true);
      expect(getPetActionAvailability(pet, 'rest', false, now).available).toBe(true);
    });

    it('energy=100, other stats<100 → rest rejected, feed/play/clean available', () => {
      const pet = buildTestPet({
        hunger: 50,
        happiness: 50,
        energy: 100,
        cleanliness: 50,
        actionCooldowns: {},
      });

      expect(getPetActionAvailability(pet, 'rest', false, now).reasonCode).toBe('STAT_ALREADY_MAXED');
      expect(getPetActionAvailability(pet, 'feed', false, now).available).toBe(true);
      expect(getPetActionAvailability(pet, 'play', false, now).available).toBe(true);
      expect(getPetActionAvailability(pet, 'clean', false, now).available).toBe(true);
    });

    it('cleanliness=100, other stats<100 → clean rejected, feed/play/rest available', () => {
      const pet = buildTestPet({
        hunger: 50,
        happiness: 50,
        energy: 50,
        cleanliness: 100,
        actionCooldowns: {},
      });

      expect(getPetActionAvailability(pet, 'clean', false, now).reasonCode).toBe('STAT_ALREADY_MAXED');
      expect(getPetActionAvailability(pet, 'feed', false, now).available).toBe(true);
      expect(getPetActionAvailability(pet, 'play', false, now).available).toBe(true);
      expect(getPetActionAvailability(pet, 'rest', false, now).available).toBe(true);
    });
  });
});

// --- applyUserAction ---

describe('applyUserAction', () => {
  describe('Successful effects', () => {
    const now = 1700000000000;

    it('feed: hunger +20, energy +5, bond +2', () => {
      const pet = buildTestPet({ hunger: 50, energy: 50, bond: 50 });
      applyUserAction(pet, 'feed', now);

      expect(pet.hunger).toBe(70);
      expect(pet.energy).toBe(55);
      expect(pet.bond).toBe(52);
    });

    it('play: happiness +20, energy -10, hunger -5, bond +2', () => {
      const pet = buildTestPet({ happiness: 50, energy: 50, hunger: 50, bond: 50 });
      applyUserAction(pet, 'play', now);

      expect(pet.happiness).toBe(70);
      expect(pet.energy).toBe(40);
      expect(pet.hunger).toBe(45);
      expect(pet.bond).toBe(52);
    });

    it('clean: cleanliness +25, happiness +5, bond +2', () => {
      const pet = buildTestPet({ cleanliness: 50, happiness: 50, bond: 50 });
      applyUserAction(pet, 'clean', now);

      expect(pet.cleanliness).toBe(75);
      expect(pet.happiness).toBe(55);
      expect(pet.bond).toBe(52);
    });

    it('rest: energy +25, hunger -5, bond +2', () => {
      const pet = buildTestPet({ energy: 50, hunger: 50, bond: 50 });
      applyUserAction(pet, 'rest', now);

      expect(pet.energy).toBe(75);
      expect(pet.hunger).toBe(45);
      expect(pet.bond).toBe(52);
    });

    it('careHistory lifetime count increments by 1', () => {
      const pet = buildTestPet();
      applyUserAction(pet, 'feed', now);

      expect(pet.careHistory!.lifetime.feed).toBe(1);
    });

    it('actionCooldowns gets set to now + ACTION_COOLDOWN_MAP[action]', () => {
      const actions: UserActionType[] = ['feed', 'play', 'clean', 'rest'];
      for (const action of actions) {
        const pet = buildTestPet();
        applyUserAction(pet, action, now);

        const cooldowns = (pet as unknown as Record<string, unknown>).actionCooldowns as Record<string, number>;
        expect(cooldowns[action]).toBe(now + ACTION_COOLDOWN_MAP[action]);
      }
    });

    it('lastXAt timestamp is updated', () => {
      const timestamp = new Date(now).toISOString();

      const petFeed = buildTestPet();
      applyUserAction(petFeed, 'feed', now);
      expect(petFeed.lastFedAt).toBe(timestamp);

      const petPlay = buildTestPet();
      applyUserAction(petPlay, 'play', now);
      expect(petPlay.lastPlayedAt).toBe(timestamp);

      const petClean = buildTestPet();
      applyUserAction(petClean, 'clean', now);
      expect(petClean.lastCleanedAt).toBe(timestamp);

      const petRest = buildTestPet();
      applyUserAction(petRest, 'rest', now);
      expect(petRest.lastRestedAt).toBe(timestamp);
    });
  });

  describe('Stat clamping', () => {
    const now = 1700000000000;

    it('hunger at 95, feed → hunger becomes 100 (not 115)', () => {
      const pet = buildTestPet({ hunger: 95 });
      applyUserAction(pet, 'feed', now);

      expect(pet.hunger).toBe(100);
    });

    it('energy at 5, play → energy becomes 0 (not -5)', () => {
      const pet = buildTestPet({ energy: 5 });
      applyUserAction(pet, 'play', now);

      expect(pet.energy).toBe(0);
    });

    it('hunger at 2, play → hunger becomes 0 (not -3)', () => {
      const pet = buildTestPet({ hunger: 2 });
      applyUserAction(pet, 'play', now);

      expect(pet.hunger).toBe(0);
    });
  });
});
