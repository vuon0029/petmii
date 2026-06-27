import { PICKED_UP_HISTORY_COOLDOWN_MS } from "../../shared/pet/careConstants";

/**
 * Client-side pre-check to reduce unnecessary IPC calls (optimization only).
 * The main process is the AUTHORITATIVE cooldown enforcer — even if the
 * renderer skips this check, the main process will reject stale pickups.
 * Uses persisted lastCountedAt from CareHistory metadata.
 */
export function shouldCountPickup(
  lastCountedAt: string | null,
  now: number
): boolean {
  if (lastCountedAt === null) {
    return true;
  }
  return (now - Date.parse(lastCountedAt)) >= PICKED_UP_HISTORY_COOLDOWN_MS;
}
