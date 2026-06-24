import { describe, it, expect, beforeEach } from 'vitest';
import {
  autonomousActionPetIds,
  restingPetIds,
  evolvingPetIds,
  userActionInProgress,
  isPetBusy,
  setAutonomousAction,
  clearAutonomousAction,
  getAutonomousActionInfo,
  setResting,
  clearResting,
  setEvolving,
  clearEvolving,
  setUserActionInProgress,
  clearUserActionInProgress,
} from './runtimePetState';

describe('runtimePetState', () => {
  beforeEach(() => {
    autonomousActionPetIds.clear();
    restingPetIds.clear();
    evolvingPetIds.clear();
    userActionInProgress.clear();
  });

  describe('isPetBusy', () => {
    it('returns false when pet is not in any collection', () => {
      expect(isPetBusy('pet-1')).toBe(false);
    });

    it('returns true when pet has autonomous action', () => {
      setAutonomousAction('pet-1', 'autonomousRest', Date.now() + 10000);
      expect(isPetBusy('pet-1')).toBe(true);
    });

    it('returns true when pet is resting', () => {
      setResting('pet-1');
      expect(isPetBusy('pet-1')).toBe(true);
    });

    it('returns true when pet is evolving', () => {
      setEvolving('pet-1');
      expect(isPetBusy('pet-1')).toBe(true);
    });

    it('returns true when pet has user action in progress', () => {
      setUserActionInProgress('pet-1');
      expect(isPetBusy('pet-1')).toBe(true);
    });

    it('returns true when pet is in multiple collections', () => {
      setResting('pet-1');
      setEvolving('pet-1');
      expect(isPetBusy('pet-1')).toBe(true);
    });
  });

  describe('autonomous action tracking', () => {
    it('setAutonomousAction stores action info', () => {
      setAutonomousAction('pet-1', 'autonomousRest', 99999);
      expect(autonomousActionPetIds.has('pet-1')).toBe(true);
    });

    it('clearAutonomousAction removes the entry', () => {
      setAutonomousAction('pet-1', 'autonomousRest', 99999);
      clearAutonomousAction('pet-1');
      expect(autonomousActionPetIds.has('pet-1')).toBe(false);
    });

    it('getAutonomousActionInfo returns info when present', () => {
      setAutonomousAction('pet-1', 'playTogether', 12345);
      expect(getAutonomousActionInfo('pet-1')).toEqual({ action: 'playTogether', endTime: 12345 });
    });

    it('getAutonomousActionInfo returns null when not present', () => {
      expect(getAutonomousActionInfo('pet-1')).toBeNull();
    });
  });

  describe('resting tracking', () => {
    it('setResting adds pet to set', () => {
      setResting('pet-1');
      expect(restingPetIds.has('pet-1')).toBe(true);
    });

    it('clearResting removes pet from set', () => {
      setResting('pet-1');
      clearResting('pet-1');
      expect(restingPetIds.has('pet-1')).toBe(false);
    });

    it('clearResting is safe when pet not in set', () => {
      expect(() => clearResting('pet-1')).not.toThrow();
    });
  });

  describe('evolving tracking', () => {
    it('setEvolving adds pet to set', () => {
      setEvolving('pet-1');
      expect(evolvingPetIds.has('pet-1')).toBe(true);
    });

    it('clearEvolving removes pet from set', () => {
      setEvolving('pet-1');
      clearEvolving('pet-1');
      expect(evolvingPetIds.has('pet-1')).toBe(false);
    });
  });

  describe('user action in progress tracking', () => {
    it('setUserActionInProgress adds pet to set', () => {
      setUserActionInProgress('pet-1');
      expect(userActionInProgress.has('pet-1')).toBe(true);
    });

    it('clearUserActionInProgress removes pet from set', () => {
      setUserActionInProgress('pet-1');
      clearUserActionInProgress('pet-1');
      expect(userActionInProgress.has('pet-1')).toBe(false);
    });

    it('clearUserActionInProgress is safe when pet not in set', () => {
      expect(() => clearUserActionInProgress('pet-1')).not.toThrow();
    });
  });
});
