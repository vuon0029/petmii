/**
 * Cursor Position Getter Utility
 *
 * Provides a function that retrieves the cursor's screen position via IPC
 * and converts it to overlay-local coordinates by subtracting the window's
 * screen offset. Returns null if the IPC call fails.
 *
 * Designed to be called once per controller tick (every 200ms).
 */

/**
 * Fetches the current cursor position in overlay-local coordinates.
 *
 * Calls `window.petmiiAPI.getCursorPosition()` to get absolute screen
 * coordinates from the main process, then subtracts `window.screenX` and
 * `window.screenY` to produce coordinates relative to the overlay viewport.
 *
 * @returns `{ x, y }` in overlay-local pixels, or `null` if the IPC call fails.
 */
export async function getCursorPos(): Promise<{ x: number; y: number } | null> {
  try {
    const screenPos = await window.petmiiAPI.getCursorPosition();
    const x = screenPos.x - window.screenX;
    const y = screenPos.y - window.screenY;
    return { x, y };
  } catch {
    return null;
  }
}
