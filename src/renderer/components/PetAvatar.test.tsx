import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PetAvatar } from "./PetAvatar";

describe("PetAvatar", () => {
  it("renders with correct species, color, and personality classes", () => {
    const { container } = render(
      <PetAvatar species="mochi" color="pink" personality="sweet" />
    );
    const avatar = container.firstElementChild!;
    expect(avatar).toHaveClass("pet-avatar");
    expect(avatar).toHaveClass("pet-species-mochi");
    expect(avatar).toHaveClass("pet-color-pink");
    expect(avatar).toHaveClass("pet-personality-sweet");
    expect(avatar).toHaveClass("pet-size-medium");
  });

  it("applies default size of medium", () => {
    const { container } = render(
      <PetAvatar species="blob" color="blue" personality="chaotic" />
    );
    const avatar = container.firstElementChild!;
    expect(avatar).toHaveClass("pet-size-medium");
  });

  it("applies specified size class", () => {
    const { container } = render(
      <PetAvatar species="ghost" color="lavender" personality="shy" size="large" />
    );
    const avatar = container.firstElementChild!;
    expect(avatar).toHaveClass("pet-size-large");
    expect(avatar).not.toHaveClass("pet-size-medium");
  });

  it("applies small size class", () => {
    const { container } = render(
      <PetAvatar species="star" color="yellow" personality="sassy" size="small" />
    );
    const avatar = container.firstElementChild!;
    expect(avatar).toHaveClass("pet-size-small");
  });

  it("has an accessible aria-label", () => {
    const { container } = render(
      <PetAvatar species="bun" color="mint" personality="curious" />
    );
    const avatar = container.firstElementChild!;
    expect(avatar).toHaveAttribute("aria-label", "bun pet, mint colored, curious personality");
  });
});
