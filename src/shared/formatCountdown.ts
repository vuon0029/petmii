/**
 * Formats remaining milliseconds into a human-readable countdown.
 * - <= 0: "0s"
 * - < 60000ms: "{N}s" where N = Math.floor(remainingMs / 1000)
 * - >= 60000ms: "{M}m {S}s" where M = Math.floor(totalSeconds / 60), S = totalSeconds % 60
 * Uses Math.floor for seconds derivation.
 */
export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return '0s';
  const totalSeconds = Math.floor(remainingMs / 1000);
  if (remainingMs < 60_000) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * Formats seconds into autonomous session countdown "M:SS" format.
 * e.g., 72 → "1:12", 42 → "0:42"
 * M = Math.floor(remainingSeconds / 60)
 * S = remainingSeconds % 60, padded to 2 digits
 */
export function formatAutonomousCountdown(remainingSeconds: number): string {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
