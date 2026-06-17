import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EggHatchScreen } from "./EggHatchScreen";

describe("EggHatchScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the petmii title", () => {
    render(<EggHatchScreen onHatch={() => {}} />);
    expect(screen.getByText("petmii")).toBeInTheDocument();
  });

  it("renders the egg placeholder", () => {
    const { container } = render(<EggHatchScreen onHatch={() => {}} />);
    const egg = container.querySelector(".egg");
    expect(egg).toBeInTheDocument();
  });

  it("renders the Hatch Egg button", () => {
    render(<EggHatchScreen onHatch={() => {}} />);
    const button = screen.getByRole("button", { name: "Hatch Egg" });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("renders the tap instruction text", () => {
    render(<EggHatchScreen onHatch={() => {}} />);
    expect(screen.getByText("Tap to meet your new pet.")).toBeInTheDocument();
  });

  it("calls onHatch when button is clicked", () => {
    const onHatch = vi.fn();
    render(<EggHatchScreen onHatch={onHatch} />);
    fireEvent.click(screen.getByRole("button", { name: "Hatch Egg" }));
    expect(onHatch).toHaveBeenCalledTimes(1);
  });

  it("does not apply hatching class when hatching is false", () => {
    const { container } = render(<EggHatchScreen onHatch={() => {}} />);
    const egg = container.querySelector(".egg");
    expect(egg).not.toHaveClass("hatching");
  });

  it("applies hatching class when hatching is true", () => {
    const { container } = render(
      <EggHatchScreen hatching onHatch={() => {}} onAnimationEnd={() => {}} />
    );
    const egg = container.querySelector(".egg");
    expect(egg).toHaveClass("egg");
    expect(egg).toHaveClass("hatching");
  });

  it("disables button when hatching is true", () => {
    render(<EggHatchScreen hatching onHatch={() => {}} onAnimationEnd={() => {}} />);
    const button = screen.getByRole("button", { name: "Hatch Egg" });
    expect(button).toBeDisabled();
  });

  it("calls onAnimationEnd after 2000ms when hatching", () => {
    const onAnimationEnd = vi.fn();
    render(<EggHatchScreen hatching onHatch={() => {}} onAnimationEnd={onAnimationEnd} />);

    expect(onAnimationEnd).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onAnimationEnd).toHaveBeenCalledTimes(1);
  });

  it("does not call onAnimationEnd before 2000ms", () => {
    const onAnimationEnd = vi.fn();
    render(<EggHatchScreen hatching onHatch={() => {}} onAnimationEnd={onAnimationEnd} />);

    act(() => {
      vi.advanceTimersByTime(1999);
    });

    expect(onAnimationEnd).not.toHaveBeenCalled();
  });

  it("cleans up timeout on unmount", () => {
    const onAnimationEnd = vi.fn();
    const { unmount } = render(
      <EggHatchScreen hatching onHatch={() => {}} onAnimationEnd={onAnimationEnd} />
    );

    unmount();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onAnimationEnd).not.toHaveBeenCalled();
  });

  it("does not set timer when hatching is false", () => {
    const onAnimationEnd = vi.fn();
    render(<EggHatchScreen onHatch={() => {}} onAnimationEnd={onAnimationEnd} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onAnimationEnd).not.toHaveBeenCalled();
  });
});
