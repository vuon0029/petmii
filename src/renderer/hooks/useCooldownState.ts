import { useState, useEffect, useMemo } from 'react';
import { getCooldownRemainingMs, sanitizeCooldowns } from '../../shared/pet/cooldownUtils';
import { formatCountdown, formatAutonomousCountdown } from '../../shared/formatCountdown';
import { ACTION_STAT_MAP, STAT_MAXED_LABELS, ACTION_LABELS } from '../../shared/pet/actionMappings';
import type { PetState } from '../pet/petVariant';
import type { UserActionType } from '../../shared/pet/actionTypes';

export type ButtonStateReason = 'available' | 'busy' | 'cooldown' | 'stat-maxed';

export interface ActionButtonState {
  disabled: boolean;
  reason: ButtonStateReason;
  label: string;
  cooldownRemainingMs?: number;
}

export type ActionButtonStates = Record<UserActionType, ActionButtonState>;

const ACTIONS: UserActionType[] = ['feed', 'play', 'rest', 'clean'];

/** Map autonomous action names to the user action button they correspond to */
const AUTONOMOUS_TO_USER_ACTION: Record<string, UserActionType> = {
  autonomousRest: 'rest',
  playTogether: 'play',
};

function makeDefaultStates(): ActionButtonStates {
  return {
    feed: { disabled: true, reason: 'busy', label: ACTION_LABELS.feed },
    play: { disabled: true, reason: 'busy', label: ACTION_LABELS.play },
    rest: { disabled: true, reason: 'busy', label: ACTION_LABELS.rest },
    clean: { disabled: true, reason: 'busy', label: ACTION_LABELS.clean },
  };
}

/**
 * Hook that derives all four action button states from the current pet state.
 * Manages a 1s interval for countdown refresh.
 * Returns updated button states on each tick while cooldowns are active.
 */
export function useCooldownState(
  pet: PetState | null,
  isBusy: boolean,
  autonomousAction: { action: string; endTime: number } | null
): ActionButtonStates {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!pet) return;

    const cooldowns = sanitizeCooldowns(pet.actionCooldowns);
    const hasActiveCooldown = ACTIONS.some(a => getCooldownRemainingMs(cooldowns, a) > 0);

    if (!hasActiveCooldown && !autonomousAction) return;

    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [pet?.actionCooldowns, autonomousAction]);

  return useMemo(() => {
    if (!pet) {
      return makeDefaultStates();
    }

    const cooldowns = sanitizeCooldowns(pet.actionCooldowns);
    const now = Date.now();

    const states = {} as ActionButtonStates;

    for (const action of ACTIONS) {
      // Priority 1: Busy
      if (isBusy) {
        // Check if autonomous action matches this button
        if (autonomousAction) {
          const mappedAction = AUTONOMOUS_TO_USER_ACTION[autonomousAction.action];
          if (mappedAction === action) {
            const remainingSeconds = Math.max(0, Math.floor((autonomousAction.endTime - now) / 1000));
            states[action] = {
              disabled: true,
              reason: 'busy',
              label: formatAutonomousCountdown(remainingSeconds),
            };
            continue;
          }
        }
        // Busy but not the autonomous action button
        states[action] = {
          disabled: true,
          reason: 'busy',
          label: ACTION_LABELS[action],
        };
        continue;
      }

      // Priority 2: Cooldown
      const remaining = getCooldownRemainingMs(cooldowns, action, now);
      if (remaining > 0) {
        states[action] = {
          disabled: true,
          reason: 'cooldown',
          label: formatCountdown(remaining),
          cooldownRemainingMs: remaining,
        };
        continue;
      }

      // Priority 3: Stat maxed
      const statKey = ACTION_STAT_MAP[action];
      if (pet[statKey] >= 100) {
        states[action] = {
          disabled: true,
          reason: 'stat-maxed',
          label: STAT_MAXED_LABELS[action],
        };
        continue;
      }

      // Available
      states[action] = {
        disabled: false,
        reason: 'available',
        label: ACTION_LABELS[action],
      };
    }

    return states;
  }, [pet, isBusy, autonomousAction, tick]);
}
