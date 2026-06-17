import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatBar } from "./StatBar";

describe("StatBar", () => {
  it("renders with label and progress bar", () => {
    render(<StatBar label="Hunger" value={75} />);
    expect(screen.getByText("Hunger")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("sets correct aria attributes", () => {
    render(<StatBar label="Energy" value={80} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "80");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
  });

  it("clamps value to 0 when below range", () => {
    render(<StatBar label="Bond" value={-10} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "0");
  });

  it("clamps value to 100 when above range", () => {
    render(<StatBar label="Happiness" value={150} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "100");
  });

  it("applies custom color to the fill bar", () => {
    const { container } = render(<StatBar label="Cleanliness" value={60} color="#ff0000" />);
    const fill = container.querySelector(".stat-bar__fill")!;
    expect(fill).toHaveStyle({ backgroundColor: "#ff0000", width: "60%" });
  });

  it("uses default green color when no color prop is provided", () => {
    const { container } = render(<StatBar label="Hunger" value={50} />);
    const fill = container.querySelector(".stat-bar__fill")!;
    expect(fill).toHaveStyle({ backgroundColor: "#4caf50" });
  });
});
