import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePetState } from "./usePetState";
import { PetState } from "../pet/petVariant";

// Mock the petmiiAPI on window
const mockSavePet = vi.fn().mockResolvedValue(true);
const mockClearPet = vi.fn().mockResolvedValue(true);

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).petmiiAPI = {
    loadPet: vi.fn(),
    savePet: mockSavePet,
    clearPet: mockClearPet,
    openOverlay: vi.fn(),
    closeOverlay: vi.fn(),
    updateOverlay: vi.fn(),
    onVariantUpdate: vi.fn(),
  };
});

function createTestPetState(overrides: Partial<PetState> = {}): PetState {
  return {
    id: "test-id-123",
    name: "Mochi",
    species: "mochi",
    color: "cream",
    personality: "sweet",
    hunger: 50,
    happiness: 50,
    energy: 50,
    cleanliness: 50,
    bond: 10,
    mood: "happy",
    lifeStage: "baby",
    lastMessage: "Your new pet hatched!",
    lastFedAt: null,
    lastPlayedAt: null,
    lastCleanedAt: null,
    lastRestedAt: null,
    hatchedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("usePetState", () => {
  describe("rename()", () => {
    it("updates name with trimmed value and persists", async () => {
      const petState = createTestPetState({ name: "OldName" });
      const setPetState = vi.fn();

      const { result } = renderHook(() => usePetState(petState, setPetState));

      await act(async () => {
        await result.current.rename("  NewName  ");
      });

      expect(setPetState).toHaveBeenCalledWith(
        expect.objectContaining({ name: "NewName" })
      );
      expect(mockSavePet).toHaveBeenCalledWith(
        expect.objectContaining({ name: "NewName" })
      );
    });

    it("throws error for empty name", async () => {
      const petState = createTestPetState();
      const setPetState = vi.fn();

      const { result } = renderHook(() => usePetState(petState, setPetState));

      await expect(
        act(async () => {
          await result.current.rename("");
        })
      ).rejects.toThrow("Name cannot be empty");

      expect(mockSavePet).not.toHaveBeenCalled();
    });

    it("throws error for whitespace-only name", async () => {
      const petState = createTestPetState();
      const setPetState = vi.fn();

      const { result } = renderHook(() => usePetState(petState, setPetState));

      await expect(
        act(async () => {
          await result.current.rename("   ");
        })
      ).rejects.toThrow("Name cannot be empty");

      expect(mockSavePet).not.toHaveBeenCalled();
    });

    it("throws error for name exceeding 20 characters", async () => {
      const petState = createTestPetState();
      const setPetState = vi.fn();

      const { result } = renderHook(() => usePetState(petState, setPetState));

      await expect(
        act(async () => {
          await result.current.rename("A".repeat(21));
        })
      ).rejects.toThrow("Name must be 20 characters or fewer");

      expect(mockSavePet).not.toHaveBeenCalled();
    });

    it("accepts name of exactly 20 characters", async () => {
      const petState = createTestPetState();
      const setPetState = vi.fn();

      const { result } = renderHook(() => usePetState(petState, setPetState));

      await act(async () => {
        await result.current.rename("A".repeat(20));
      });

      expect(setPetState).toHaveBeenCalledWith(
        expect.objectContaining({ name: "A".repeat(20) })
      );
    });

    it("updates updatedAt on rename", async () => {
      const petState = createTestPetState();
      const setPetState = vi.fn();

      const { result } = renderHook(() => usePetState(petState, setPetState));

      await act(async () => {
        await result.current.rename("NewName");
      });

      const updated = setPetState.mock.calls[0][0];
      expect(updated.updatedAt).not.toBe("2024-01-01T00:00:00.000Z");
    });

    it("returns null when petState is null", async () => {
      const setPetState = vi.fn();

      const { result } = renderHook(() => usePetState(null, setPetState));

      let returnValue: PetState | null = null;
      await act(async () => {
        returnValue = await result.current.rename("Test");
      });

      expect(returnValue).toBeNull();
      expect(mockSavePet).not.toHaveBeenCalled();
    });
  });

  describe("reset()", () => {
    it("calls clearPet and sets state to null", async () => {
      const petState = createTestPetState();
      const setPetState = vi.fn();

      const { result } = renderHook(() => usePetState(petState, setPetState));

      let returnValue: null = null;
      await act(async () => {
        returnValue = await result.current.reset();
      });

      expect(mockClearPet).toHaveBeenCalled();
      expect(setPetState).toHaveBeenCalledWith(null);
      expect(returnValue).toBeNull();
    });
  });
});
