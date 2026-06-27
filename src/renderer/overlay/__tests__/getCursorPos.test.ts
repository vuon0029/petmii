import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCursorPos } from "../getCursorPos";

describe("getCursorPos", () => {
  const originalScreenX = window.screenX;
  const originalScreenY = window.screenY;

  beforeEach(() => {
    // Mock window.petmiiAPI.getCursorPosition
    (window as unknown as { petmiiAPI: { getCursorPosition: () => Promise<{ x: number; y: number }> } }).petmiiAPI = {
      getCursorPosition: vi.fn(),
    };
    // Mock window.screenX/screenY (overlay window screen offset)
    Object.defineProperty(window, "screenX", { value: 0, writable: true, configurable: true });
    Object.defineProperty(window, "screenY", { value: 0, writable: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, "screenX", { value: originalScreenX, writable: true, configurable: true });
    Object.defineProperty(window, "screenY", { value: originalScreenY, writable: true, configurable: true });
  });

  it("returns overlay-local coordinates by subtracting window screen offset", async () => {
    (window.petmiiAPI.getCursorPosition as ReturnType<typeof vi.fn>).mockResolvedValue({ x: 500, y: 300 });
    Object.defineProperty(window, "screenX", { value: 100, configurable: true });
    Object.defineProperty(window, "screenY", { value: 50, configurable: true });

    const result = await getCursorPos();

    expect(result).toEqual({ x: 400, y: 250 });
  });

  it("returns correct coordinates when window is at (0, 0)", async () => {
    (window.petmiiAPI.getCursorPosition as ReturnType<typeof vi.fn>).mockResolvedValue({ x: 200, y: 150 });
    Object.defineProperty(window, "screenX", { value: 0, configurable: true });
    Object.defineProperty(window, "screenY", { value: 0, configurable: true });

    const result = await getCursorPos();

    expect(result).toEqual({ x: 200, y: 150 });
  });

  it("returns null when IPC call fails", async () => {
    (window.petmiiAPI.getCursorPosition as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("IPC failed"));

    const result = await getCursorPos();

    expect(result).toBeNull();
  });

  it("returns null when petmiiAPI is unavailable", async () => {
    // Simulate petmiiAPI.getCursorPosition throwing
    (window.petmiiAPI.getCursorPosition as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("not available");
    });

    const result = await getCursorPos();

    expect(result).toBeNull();
  });

  it("can return negative coordinates when cursor is above/left of overlay", async () => {
    (window.petmiiAPI.getCursorPosition as ReturnType<typeof vi.fn>).mockResolvedValue({ x: 50, y: 30 });
    Object.defineProperty(window, "screenX", { value: 100, configurable: true });
    Object.defineProperty(window, "screenY", { value: 100, configurable: true });

    const result = await getCursorPos();

    expect(result).toEqual({ x: -50, y: -70 });
  });
});
