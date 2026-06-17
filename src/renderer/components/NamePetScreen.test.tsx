import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NamePetScreen } from "./NamePetScreen";
import { PetVariant } from "../pet/petVariant";

const mockVariant: PetVariant = {
  species: "mochi",
  color: "pink",
  personality: "sweet",
};

describe("NamePetScreen", () => {
  it("renders header text", () => {
    render(<NamePetScreen variant={mockVariant} onNameSubmit={() => {}} />);
    expect(screen.getByText("Name your new pet!")).toBeInTheDocument();
  });

  it("displays PetAvatar preview with correct variant", () => {
    const { container } = render(
      <NamePetScreen variant={mockVariant} onNameSubmit={() => {}} />
    );
    const avatar = container.querySelector(".pet-avatar");
    expect(avatar).toHaveClass("pet-species-mochi");
    expect(avatar).toHaveClass("pet-color-pink");
    expect(avatar).toHaveClass("pet-personality-sweet");
  });

  it("pre-fills input with species default name", () => {
    render(<NamePetScreen variant={mockVariant} onNameSubmit={() => {}} />);
    const input = screen.getByLabelText("Pet name") as HTMLInputElement;
    expect(input.value).toBe("Mochi");
  });

  it("pre-fills with correct default for each species", () => {
    const ghostVariant: PetVariant = {
      species: "ghost",
      color: "lavender",
      personality: "shy",
    };
    render(<NamePetScreen variant={ghostVariant} onNameSubmit={() => {}} />);
    const input = screen.getByLabelText("Pet name") as HTMLInputElement;
    expect(input.value).toBe("Boo");
  });

  it("has placeholder text 'Name your pet'", () => {
    render(<NamePetScreen variant={mockVariant} onNameSubmit={() => {}} />);
    const input = screen.getByPlaceholderText("Name your pet");
    expect(input).toBeInTheDocument();
  });

  it("has maxLength of 20 on the input", () => {
    render(<NamePetScreen variant={mockVariant} onNameSubmit={() => {}} />);
    const input = screen.getByLabelText("Pet name") as HTMLInputElement;
    expect(input.maxLength).toBe(20);
  });

  it("shows error when submitting empty name", () => {
    render(<NamePetScreen variant={mockVariant} onNameSubmit={() => {}} />);
    const input = screen.getByLabelText("Pet name");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByText("Confirm"));
    expect(screen.getByText("A non-empty name is required")).toBeInTheDocument();
  });

  it("shows error when submitting whitespace-only name", () => {
    render(<NamePetScreen variant={mockVariant} onNameSubmit={() => {}} />);
    const input = screen.getByLabelText("Pet name");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByText("Confirm"));
    expect(screen.getByText("A non-empty name is required")).toBeInTheDocument();
  });

  it("calls onNameSubmit with trimmed name on valid submission", () => {
    const onNameSubmit = vi.fn();
    render(<NamePetScreen variant={mockVariant} onNameSubmit={onNameSubmit} />);
    const input = screen.getByLabelText("Pet name");
    fireEvent.change(input, { target: { value: "  Fluffy  " } });
    fireEvent.click(screen.getByText("Confirm"));
    expect(onNameSubmit).toHaveBeenCalledWith("Fluffy");
  });

  it("does not call onNameSubmit when validation fails", () => {
    const onNameSubmit = vi.fn();
    render(<NamePetScreen variant={mockVariant} onNameSubmit={onNameSubmit} />);
    const input = screen.getByLabelText("Pet name");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByText("Confirm"));
    expect(onNameSubmit).not.toHaveBeenCalled();
  });

  it("clears error when user types in the input", () => {
    render(<NamePetScreen variant={mockVariant} onNameSubmit={() => {}} />);
    const input = screen.getByLabelText("Pet name");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByText("Confirm"));
    expect(screen.getByText("A non-empty name is required")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "A" } });
    expect(screen.queryByText("A non-empty name is required")).not.toBeInTheDocument();
  });

  it("renders Confirm button", () => {
    render(<NamePetScreen variant={mockVariant} onNameSubmit={() => {}} />);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });
});
