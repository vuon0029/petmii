import { describe, it, expect } from 'vitest';
import {
  isAutonomousEligibleRuntimeState,
  BLOCKING_ACTIONS,
} from './autonomousEligibility';

describe('isAutonomousEligibleRuntimeState', () => {
  it('returns true for idle physics, idle action, normal lifecycle', () => {
    expect(
      isAutonomousEligibleRuntimeState({
        physicsState: 'idle',
        currentAction: 'idle',
        lifecycleState: 'normal',
      })
    ).toBe(true);
  });

  describe('returns true for interruptible idle behaviors', () => {
    const interruptibleActions = [
      'idleAnimation',
      'lightBobbing',
      'passiveWandering',
      'ambientIdleMovement',
      'someNewUnknownIdleBehavior',
    ];

    it.each(interruptibleActions)(
      'returns true when currentAction is "%s"',
      (action) => {
        expect(
          isAutonomousEligibleRuntimeState({
            physicsState: 'idle',
            currentAction: action,
            lifecycleState: 'normal',
          })
        ).toBe(true);
      }
    );
  });

  describe('returns false for each BLOCKING_ACTION', () => {
    const expectedBlockingActions = [
      'rest',
      'sleep',
      'manualRest',
      'autonomousRest',
      'playTogether',
      'feed',
      'play',
      'clean',
      'approachCursor',
      'evolving',
    ];

    it.each(expectedBlockingActions)(
      'returns false when currentAction is "%s"',
      (action) => {
        expect(
          isAutonomousEligibleRuntimeState({
            physicsState: 'idle',
            currentAction: action,
            lifecycleState: 'normal',
          })
        ).toBe(false);
      }
    );

    it('BLOCKING_ACTIONS contains expected entries', () => {
      expect(BLOCKING_ACTIONS).toEqual(expectedBlockingActions);
    });
  });

  describe('returns false for non-idle physicsState', () => {
    const nonIdlePhysicsStates = ['dragging', 'flying', 'landed', 'gettingUp'];

    it.each(nonIdlePhysicsStates)(
      'returns false when physicsState is "%s"',
      (physicsState) => {
        expect(
          isAutonomousEligibleRuntimeState({
            physicsState,
            currentAction: 'idle',
            lifecycleState: 'normal',
          })
        ).toBe(false);
      }
    );
  });

  describe('returns false for lifecycleState "evolving"', () => {
    it('returns false even with idle physics and idle action', () => {
      expect(
        isAutonomousEligibleRuntimeState({
          physicsState: 'idle',
          currentAction: 'idle',
          lifecycleState: 'evolving',
        })
      ).toBe(false);
    });
  });
});
