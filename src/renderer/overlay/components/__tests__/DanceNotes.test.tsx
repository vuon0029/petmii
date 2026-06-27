import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { DanceNotes } from "../DanceNotes";

describe("DanceNotes", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when isActive is false", () => {
    const { container } = render(
      <DanceNotes petX={100} petY={200} petSize={48} isActive={false} />,
    );
    expect(container.querySelector(".dance-notes-container")).toBeNull();
  });

  it("renders emojis when isActive is true", () => {
    vi.useFakeTimers();
    const { container } = render(
      <DanceNotes petX={100} petY={200} petSize={48} isActive={true} />,
    );

    // After initial spawn, there should be at least one note
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const notes = container.querySelectorAll(".dance-note");
    expect(notes.length).toBeGreaterThanOrEqual(1);
  });

  it("container has pointer-events: none", () => {
    vi.useFakeTimers();
    const { container } = render(
      <DanceNotes petX={100} petY={200} petSize={48} isActive={true} />,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const notesContainer = container.querySelector(".dance-notes-container") as HTMLElement;
    expect(notesContainer).not.toBeNull();
    expect(notesContainer.style.pointerEvents).toBe("none");
  });

  it("emojis are positioned relative to pet container", () => {
    vi.useFakeTimers();
    const petSize = 48;
    const { container } = render(
      <DanceNotes petX={150} petY={300} petSize={petSize} isActive={true} />,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const notes = container.querySelectorAll(".dance-note") as NodeListOf<HTMLElement>;
    const centerX = petSize / 2;

    for (const note of notes) {
      const left = parseFloat(note.style.left);
      // Notes should be within 40px spread of center
      expect(Math.abs(left - centerX)).toBeLessThanOrEqual(40);
    }
  });

  it("clears all notes when isActive transitions to false", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <DanceNotes petX={100} petY={200} petSize={48} isActive={true} />,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should have notes
    expect(container.querySelectorAll(".dance-note").length).toBeGreaterThan(0);

    // Deactivate
    rerender(<DanceNotes petX={100} petY={200} petSize={48} isActive={false} />);

    expect(container.querySelector(".dance-notes-container")).toBeNull();
  });
});
