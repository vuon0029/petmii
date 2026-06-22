import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PetAvatar } from "./PetAvatar";

// Mock the fallbackResolver to control sprite resolution in tests
vi.mock("../assets/pet/fallbackResolver", () => ({
  resolveSprite: vi.fn(),
}));

// Mock the spriteRegistry
vi.mock("../assets/pet/spriteRegistry", () => ({
  spriteRegistry: {},
}));

import { resolveSprite } from "../assets/pet/fallbackResolver";
const mockResolveSprite = vi.mocked(resolveSprite);

describe("PetAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CSS fallback avatar (resolveSprite returns null)", () => {
    beforeEach(() => {
      mockResolveSprite.mockReturnValue(null);
    });

    it("renders with correct species, variantId, and personality classes", () => {
      const { container } = render(
        <PetAvatar
          species="mochi"
          variantId="pink"
          lifeStage="adult"
          visualState="idle"
          personality="sweet"
        />
      );
      const avatar = container.firstElementChild!;
      expect(avatar).toHaveClass("pet-avatar");
      expect(avatar).toHaveClass("pet-species-mochi");
      expect(avatar).toHaveClass("pet-color-pink");
      expect(avatar).toHaveClass("pet-personality-sweet");
    });

    it("has an accessible aria-label", () => {
      const { container } = render(
        <PetAvatar
          species="bun"
          variantId="mint"
          lifeStage="baby"
          visualState="idle"
          personality="curious"
        />
      );
      const avatar = container.firstElementChild!;
      expect(avatar).toHaveAttribute(
        "aria-label",
        "bun pet, mint colored, curious personality"
      );
    });
  });

  describe("Sprite-based avatar (resolveSprite returns a sprite)", () => {
    const mockResolved = {
      src: "/path/to/sprite.png",
      metadata: {
        frameSize: 48,
        frameCount: 5,
        durationMs: 1300,
        loop: true,
      },
    };

    beforeEach(() => {
      mockResolveSprite.mockReturnValue(mockResolved);
    });

    it("renders sprite container with correct background styles", () => {
      const { container } = render(
        <PetAvatar
          species="blob"
          variantId="blue"
          lifeStage="adult"
          visualState="idle"
          personality="chaotic"
        />
      );
      const el = container.firstElementChild as HTMLElement;
      expect(el).toHaveClass("pet-avatar-container");
      expect(el.style.backgroundImage).toContain("/path/to/sprite.png");
      expect(el.style.width).toBe("48px");
      expect(el.style.height).toBe("48px");
      expect(el.style.backgroundSize).toBe("240px 48px");
    });

    it("applies animation with correct duration and steps", () => {
      const { container } = render(
        <PetAvatar
          species="blob"
          variantId="blue"
          lifeStage="adult"
          visualState="idle"
          personality="chaotic"
        />
      );
      const el = container.firstElementChild as HTMLElement;
      expect(el.style.animation).toContain("moveSpritesheet");
      expect(el.style.animation).toContain("1300ms");
      expect(el.style.animation).toContain("steps(5)");
      expect(el.style.animation).toContain("infinite");
    });

    it("applies non-looping animation when loop is false", () => {
      mockResolveSprite.mockReturnValue({
        src: "/path/to/sprite.png",
        metadata: { frameSize: 48, frameCount: 3, durationMs: 500, loop: false },
      });

      const { container } = render(
        <PetAvatar
          species="frog"
          variantId="yellow"
          lifeStage="baby"
          visualState="sleep"
          personality="sleepy"
        />
      );
      const el = container.firstElementChild as HTMLElement;
      expect(el.style.animation).toContain("1");
      expect(el.style.animation).not.toContain("infinite");
      expect(el.style.animationFillMode).toBe("forwards");
    });

    it("renders static mode without animation", () => {
      const { container } = render(
        <PetAvatar
          species="blob"
          variantId="yellow"
          lifeStage="child"
          visualState="idle"
          personality="shy"
          static
        />
      );
      const el = container.firstElementChild as HTMLElement;
      expect(el).toHaveClass("pet-avatar-static");
      expect(el.style.animation).toBe("");
    });

    it("passes correct args to resolveSprite for idle state", () => {
      render(
        <PetAvatar
          species="frog"
          variantId="blue"
          lifeStage="child"
          visualState="idle"
          personality="curious"
        />
      );
      expect(mockResolveSprite).toHaveBeenCalledWith(
        "frog",
        "blue",
        "child",
        "idle",
        expect.anything()
      );
    });

    it("passes correct args to resolveSprite for sleep state", () => {
      render(
        <PetAvatar
          species="frog"
          variantId="pink"
          lifeStage="adult"
          visualState="sleep"
          personality="sleepy"
        />
      );
      expect(mockResolveSprite).toHaveBeenCalledWith(
        "frog",
        "pink",
        "adult",
        "sleep",
        expect.anything()
      );
    });

    it("applies custom metadata values to container styles", () => {
      mockResolveSprite.mockReturnValue({
        src: "/custom-sprite.png",
        metadata: { frameSize: 64, frameCount: 8, durationMs: 2000, loop: true },
      });

      const { container } = render(
        <PetAvatar
          species="blob"
          variantId="shiny"
          lifeStage="adult"
          visualState="idle"
          personality="sassy"
        />
      );
      const el = container.firstElementChild as HTMLElement;
      expect(el.style.width).toBe("64px");
      expect(el.style.height).toBe("64px");
      expect(el.style.backgroundSize).toBe("512px 64px"); // 64*8 = 512
      expect(el.style.animation).toContain("2000ms");
      expect(el.style.animation).toContain("steps(8)");
    });
  });

  describe("Visual state swapping", () => {
    it("resolves different sprites for idle vs sleep visual states", () => {
      mockResolveSprite.mockImplementation((_s, _v, _l, visualState) => {
        if (visualState === "idle") {
          return {
            src: "/idle-sprite.png",
            metadata: { frameSize: 48, frameCount: 5, durationMs: 1300, loop: true },
          };
        }
        return {
          src: "/sleep-sprite.png",
          metadata: { frameSize: 48, frameCount: 3, durationMs: 2000, loop: true },
        };
      });

      const { container: c1 } = render(
        <PetAvatar
          species="blob"
          variantId="blue"
          lifeStage="adult"
          visualState="idle"
          personality="sweet"
        />
      );
      expect((c1.firstElementChild as HTMLElement).style.backgroundImage).toContain(
        "idle-sprite.png"
      );

      const { container: c2 } = render(
        <PetAvatar
          species="blob"
          variantId="blue"
          lifeStage="adult"
          visualState="sleep"
          personality="sweet"
        />
      );
      expect((c2.firstElementChild as HTMLElement).style.backgroundImage).toContain(
        "sleep-sprite.png"
      );
    });
  });
});
