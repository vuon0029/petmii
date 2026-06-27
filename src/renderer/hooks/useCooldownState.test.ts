import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCooldownState } from './useCooldownState';
import type { PetState } from '../pet/petVariant';

function createTestPet(overrides: Partial<PetState> = {}): PetState {
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
    bond: 10,
    hp: 100,
    isAlive: true,
    mood: 'happy',
    lifeStage: 'baby',
    lastMessage: 'Hello!',
    lastFedAt: null,
    lastPlayedAt: null,
    lastCleanedAt: null,
    lastRestedAt: null,
    hatchedAt: '2024-01-01T00:00:00.000Z',
    diedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useCooldownState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('busy state disables all buttons', () => {
    it('disables all 4 buttons with reason=busy and normal labels when isBusy=true', () => {
      const pet = createTestPet({ hunger: 70, happiness: 30, energy: 60, cleanliness: 80 });

      const { result } = renderHook(() => useCooldownState(pet, true, null));

      expect(result.current.feed).toEqual({ disabled: true, reason: 'busy', label: 'Feed' });
      expect(result.current.play).toEqual({ disabled: true, reason: 'busy', label: 'Play' });
      expect(result.current.rest).toEqual({ disabled: true, reason: 'busy', label: 'Rest' });
      expect(result.current.clean).toEqual({ disabled: true, reason: 'busy', label: 'Clean' });
    });
  });

  describe('autonomous countdown on matching button', () => {
    it('shows M:SS countdown on rest button for autonomousRest', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const pet = createTestPet();

      const { result } = renderHook(() =>
        useCooldownState(pet, true, { action: 'autonomousRest', endTime: now + 42000 })
      );

      // Rest button shows autonomous countdown
      expect(result.current.rest.disabled).toBe(true);
      expect(result.current.rest.reason).toBe('busy');
      expect(result.current.rest.label).toBe('0:42');

      // Other buttons show normal labels
      expect(result.current.feed.label).toBe('Feed');
      expect(result.current.play.label).toBe('Play');
      expect(result.current.clean.label).toBe('Clean');
    });
  });

  describe('cooldown shows countdown format', () => {
    it('shows cooldown with countdown label when action is on cooldown', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const pet = createTestPet({
        actionCooldowns: { feed: now + 42000 },
      });

      const { result } = renderHook(() => useCooldownState(pet, false, null));

      expect(result.current.feed.disabled).toBe(true);
      expect(result.current.feed.reason).toBe('cooldown');
      expect(result.current.feed.label).toBe('42s');
    });
  });

  describe('stat-maxed shows correct labels', () => {
    it('shows "Full" when hunger is 100', () => {
      const pet = createTestPet({ hunger: 100 });

      const { result } = renderHook(() => useCooldownState(pet, false, null));

      expect(result.current.feed).toEqual({ disabled: true, reason: 'stat-maxed', label: 'Full' });
    });

    it('shows "Happy" when happiness is 100', () => {
      const pet = createTestPet({ happiness: 100 });

      const { result } = renderHook(() => useCooldownState(pet, false, null));

      expect(result.current.play).toEqual({ disabled: true, reason: 'stat-maxed', label: 'Happy' });
    });

    it('shows "Rested" when energy is 100', () => {
      const pet = createTestPet({ energy: 100 });

      const { result } = renderHook(() => useCooldownState(pet, false, null));

      expect(result.current.rest).toEqual({ disabled: true, reason: 'stat-maxed', label: 'Rested' });
    });

    it('shows "Clean" when cleanliness is 100', () => {
      const pet = createTestPet({ cleanliness: 100 });

      const { result } = renderHook(() => useCooldownState(pet, false, null));

      expect(result.current.clean).toEqual({ disabled: true, reason: 'stat-maxed', label: 'Clean' });
    });
  });

  describe('priority ordering', () => {
    it('cooldown takes priority over stat-maxed for the same action', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const pet = createTestPet({
        hunger: 100,
        actionCooldowns: { feed: now + 42000 },
      });

      const { result } = renderHook(() => useCooldownState(pet, false, null));

      // Cooldown should win over stat-maxed
      expect(result.current.feed.disabled).toBe(true);
      expect(result.current.feed.reason).toBe('cooldown');
      expect(result.current.feed.label).toBe('42s');
    });
  });

  describe('available state', () => {
    it('all buttons enabled with reason=available when no conditions apply', () => {
      const pet = createTestPet({
        hunger: 50,
        happiness: 50,
        energy: 50,
        cleanliness: 50,
      });

      const { result } = renderHook(() => useCooldownState(pet, false, null));

      expect(result.current.feed).toEqual({ disabled: false, reason: 'available', label: 'Feed' });
      expect(result.current.play).toEqual({ disabled: false, reason: 'available', label: 'Play' });
      expect(result.current.rest).toEqual({ disabled: false, reason: 'available', label: 'Rest' });
      expect(result.current.clean).toEqual({ disabled: false, reason: 'available', label: 'Clean' });
    });
  });

  describe('null pet returns default disabled states', () => {
    it('all buttons disabled with reason=busy when pet is null', () => {
      const { result } = renderHook(() => useCooldownState(null, false, null));

      expect(result.current.feed).toEqual({ disabled: true, reason: 'busy', label: 'Feed' });
      expect(result.current.play).toEqual({ disabled: true, reason: 'busy', label: 'Play' });
      expect(result.current.rest).toEqual({ disabled: true, reason: 'busy', label: 'Rest' });
      expect(result.current.clean).toEqual({ disabled: true, reason: 'busy', label: 'Clean' });
    });
  });
});
