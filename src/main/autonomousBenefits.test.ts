import { describe, it, expect } from 'vitest';
import { applyAutonomousRestBenefits, applyPlayTogetherBenefits } from './autonomousBenefits';
import { createDefaultCareHistory } from '../shared/pet/careHistory';
import type { PetState } from '../renderer/pet/petVariant';
import type { PetActionCooldowns } from '../shared/pet/actionTypes';

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

// --- applyAutonomousRestBenefits ---

describe('applyAutonomousRestBenefits', () => {
  it('applies correct benefit calculations: energy +13, hunger -3, bond +1', () => {
    const pet = buildTestPet({ energy: 50, hunger: 50, bond: 50 });

    applyAutonomousRestBenefits(pet);

    expect(pet.energy).toBe(63);  // +Math.round(25 * 0.5) = +13
    expect(pet.hunger).toBe(47);  // -Math.round(5 * 0.5) = -3
    expect(pet.bond).toBe(51);    // +Math.round(2 * 0.5) = +1
  });

  it('clamps energy to 100 when near max', () => {
    const pet = buildTestPet({ energy: 95 });

    applyAutonomousRestBenefits(pet);

    expect(pet.energy).toBe(100); // not 108
  });

  it('clamps hunger to 0 when near min', () => {
    const pet = buildTestPet({ hunger: 1 });

    applyAutonomousRestBenefits(pet);

    expect(pet.hunger).toBe(0); // not -2
  });

  it('does not modify actionCooldowns', () => {
    const cooldowns: PetActionCooldowns = {
      feed: Date.now() + 60000,
      rest: Date.now() + 120000,
    };
    const pet = buildTestPet({ actionCooldowns: cooldowns });
    const cooldownsBefore = { ...pet.actionCooldowns };

    applyAutonomousRestBenefits(pet);

    expect(pet.actionCooldowns).toEqual(cooldownsBefore);
  });

  it('does not modify careHistory counts', () => {
    const pet = buildTestPet({ careHistory: createDefaultCareHistory() });
    const historyBefore = JSON.parse(JSON.stringify(pet.careHistory));

    applyAutonomousRestBenefits(pet);

    expect(pet.careHistory).toEqual(historyBefore);
  });
});

// --- applyPlayTogetherBenefits ---

describe('applyPlayTogetherBenefits', () => {
  it('applies correct benefit calculations: happiness +10, energy -5, hunger -3, bond +1', () => {
    const pet = buildTestPet({ happiness: 50, energy: 50, hunger: 50, bond: 50 });

    applyPlayTogetherBenefits(pet);

    expect(pet.happiness).toBe(60); // +Math.round(20 * 0.5) = +10
    expect(pet.energy).toBe(45);    // -Math.round(10 * 0.5) = -5
    expect(pet.hunger).toBe(47);    // -Math.round(5 * 0.5) = -3
    expect(pet.bond).toBe(51);      // +Math.round(2 * 0.5) = +1
  });

  it('clamps happiness to 100 when near max', () => {
    const pet = buildTestPet({ happiness: 95 });

    applyPlayTogetherBenefits(pet);

    expect(pet.happiness).toBe(100); // not 105
  });

  it('clamps energy to 0 when near min', () => {
    const pet = buildTestPet({ energy: 3 });

    applyPlayTogetherBenefits(pet);

    expect(pet.energy).toBe(0); // not -2
  });

  it('does not modify actionCooldowns', () => {
    const cooldowns: PetActionCooldowns = {
      play: Date.now() + 60000,
      clean: Date.now() + 90000,
    };
    const pet = buildTestPet({ actionCooldowns: cooldowns });
    const cooldownsBefore = { ...pet.actionCooldowns };

    applyPlayTogetherBenefits(pet);

    expect(pet.actionCooldowns).toEqual(cooldownsBefore);
  });

  it('does not modify careHistory counts', () => {
    const pet = buildTestPet({ careHistory: createDefaultCareHistory() });
    const historyBefore = JSON.parse(JSON.stringify(pet.careHistory));

    applyPlayTogetherBenefits(pet);

    expect(pet.careHistory).toEqual(historyBefore);
  });
});
