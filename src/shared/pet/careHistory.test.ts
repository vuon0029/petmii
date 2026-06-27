import { describe, it, expect } from "vitest";
import {
  createDefaultCareHistory,
  incrementCareAction,
  ensureCareHistory,
  type CareAction,
  type CareHistory,
} from "./careHistory";

describe("createDefaultCareHistory", () => {
  it("returns a CareHistory with all zero lifetime counts", () => {
    const history = createDefaultCareHistory();
    for (const action of Object.keys(history.lifetime) as CareAction[]) {
      expect(history.lifetime[action]).toBe(0);
    }
  });

  it("returns all zero per-stage counts for each stage", () => {
    const history = createDefaultCareHistory();
    for (const stage of ["baby", "child", "adult"] as const) {
      for (const action of Object.keys(history.perStage[stage]) as CareAction[]) {
        expect(history.perStage[stage][action]).toBe(0);
      }
    }
  });

  it("returns metadata with null pickedUpLastCountedAt", () => {
    const history = createDefaultCareHistory();
    expect(history.metadata.pickedUpLastCountedAt).toBeNull();
  });
});

describe("incrementCareAction", () => {
  it("increments lifetime count for the specified action by 1", () => {
    const history = createDefaultCareHistory();
    const updated = incrementCareAction(history, "feed", "baby");
    expect(updated.lifetime.feed).toBe(1);
  });

  it("increments perStage count for the specified action and stage by 1", () => {
    const history = createDefaultCareHistory();
    const updated = incrementCareAction(history, "play", "child");
    expect(updated.perStage.child.play).toBe(1);
  });

  it("does not modify other lifetime counts", () => {
    const history = createDefaultCareHistory();
    const updated = incrementCareAction(history, "feed", "baby");
    expect(updated.lifetime.play).toBe(0);
    expect(updated.lifetime.rest).toBe(0);
    expect(updated.lifetime.clean).toBe(0);
    expect(updated.lifetime.pickedUp).toBe(0);
    expect(updated.lifetime.throw).toBe(0);
    expect(updated.lifetime.gentleThrow).toBe(0);
    expect(updated.lifetime.hardThrow).toBe(0);
  });

  it("does not modify other stage counts", () => {
    const history = createDefaultCareHistory();
    const updated = incrementCareAction(history, "feed", "baby");
    expect(updated.perStage.child.feed).toBe(0);
    expect(updated.perStage.adult.feed).toBe(0);
    expect(updated.perStage.baby.play).toBe(0);
  });

  it("does not mutate the original history", () => {
    const history = createDefaultCareHistory();
    incrementCareAction(history, "feed", "baby");
    expect(history.lifetime.feed).toBe(0);
    expect(history.perStage.baby.feed).toBe(0);
  });

  it("preserves metadata", () => {
    const history = createDefaultCareHistory();
    history.metadata.pickedUpLastCountedAt = "2024-01-15T10:30:00.000Z";
    const updated = incrementCareAction(history, "pickedUp", "adult");
    expect(updated.metadata.pickedUpLastCountedAt).toBe("2024-01-15T10:30:00.000Z");
  });

  it("accumulates counts across multiple increments", () => {
    let history = createDefaultCareHistory();
    history = incrementCareAction(history, "feed", "baby");
    history = incrementCareAction(history, "feed", "baby");
    history = incrementCareAction(history, "feed", "child");
    expect(history.lifetime.feed).toBe(3);
    expect(history.perStage.baby.feed).toBe(2);
    expect(history.perStage.child.feed).toBe(1);
  });
});

describe("ensureCareHistory", () => {
  it("returns the careHistory if defined", () => {
    const history = createDefaultCareHistory();
    history.lifetime.feed = 5;
    const result = ensureCareHistory(history);
    expect(result).toBe(history);
    expect(result.lifetime.feed).toBe(5);
  });

  it("returns a default CareHistory if undefined", () => {
    const result = ensureCareHistory(undefined);
    expect(result.lifetime.feed).toBe(0);
    expect(result.perStage.baby.feed).toBe(0);
    expect(result.metadata.pickedUpLastCountedAt).toBeNull();
  });
});
