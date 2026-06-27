// src/renderer/pet/personalityNotes.ts
// Generates cozy personality notes based on care history and life stage.
// Uses a minimal input interface to avoid coupling to the full PetState.

import type { CareHistory, AdultTrait } from "../../shared/pet/careHistory";

export interface PersonalityNoteInput {
  name: string;
  lifeStage: "baby" | "child" | "adult";
  careHistory?: CareHistory;
  adultTrait?: AdultTrait;
}

/**
 * Generates 1-2 cozy text lines based on care history and current stage.
 * Never shows raw counts, timestamps, or thresholds.
 * All traits feel positive — Chaotic is never framed as punishment.
 */
export function generatePersonalityNotes(pet: PersonalityNoteInput): string[] {
  const { name, lifeStage, careHistory, adultTrait } = pet;

  // If no care history or all zeros, return a generic growing note
  if (!careHistory || isAllZeros(careHistory)) {
    return [`${name} is growing at their own pace.`];
  }

  // Adult with assigned trait — trait-flavored lines
  if (lifeStage === "adult" && adultTrait) {
    return generateAdultNotes(name, adultTrait, careHistory);
  }

  // Baby or child — hints based on dominant care pattern
  return generateDevelopingNotes(name, careHistory);
}

function isAllZeros(careHistory: CareHistory): boolean {
  const lt = careHistory.lifetime;
  return (
    lt.feed === 0 &&
    lt.play === 0 &&
    lt.rest === 0 &&
    lt.clean === 0 &&
    lt.pickedUp === 0 &&
    lt.throw === 0 &&
    lt.gentleThrow === 0 &&
    lt.hardThrow === 0
  );
}

function generateAdultNotes(
  name: string,
  trait: AdultTrait,
  careHistory: CareHistory
): string[] {
  const lines: string[] = [];

  switch (trait) {
    case "Playful":
      lines.push(
        `${name} is a Playful Adult who always seems ready for one more game.`
      );
      break;
    case "Affectionate":
      lines.push(
        `${name} is an Affectionate Adult who loves being close.`
      );
      break;
    case "Sleepy":
      lines.push(
        `${name} is a Sleepy Adult who knows how to stay cozy.`
      );
      break;
    case "Chaotic":
      lines.push(
        `${name} is a Chaotic Adult, fearless from all those wild flights.`
      );
      break;
    case "Classic":
      lines.push(
        `${name} is a Classic Adult — steady, familiar, and easygoing.`
      );
      break;
  }

  // Add a second line based on ongoing care history even after adulthood
  const secondLine = getOngoingCareHint(name, careHistory);
  if (secondLine) {
    lines.push(secondLine);
  }

  return lines.slice(0, 2);
}

function generateDevelopingNotes(
  name: string,
  careHistory: CareHistory
): string[] {
  const lt = careHistory.lifetime;

  // Find the dominant action category
  const categories = [
    { key: "play", count: lt.play },
    { key: "pickedUp", count: lt.pickedUp },
    { key: "gentleThrow", count: lt.gentleThrow },
    { key: "rest", count: lt.rest },
    { key: "hardThrow", count: lt.hardThrow },
  ];

  categories.sort((a, b) => b.count - a.count);

  const dominant = categories[0];

  // If the dominant count is 0 or tied at low activity, generic note
  if (dominant.count === 0) {
    return [`${name} is growing at their own pace.`];
  }

  switch (dominant.key) {
    case "play":
      return [`${name} seems extra playful lately.`];
    case "pickedUp":
      return [`${name} loves being picked up.`];
    case "gentleThrow":
      return [`${name} is getting braver from all those little tosses.`];
    case "rest":
      return [`${name} has been very cozy lately.`];
    case "hardThrow":
      return [`${name} seems fearless after all those wild flights.`];
    default:
      return [`${name} is growing at their own pace.`];
  }
}

/**
 * Returns an optional second line for adults based on their ongoing care patterns.
 */
function getOngoingCareHint(
  name: string,
  careHistory: CareHistory
): string | null {
  const adult = careHistory.perStage.adult;

  const categories = [
    { key: "play", count: adult.play },
    { key: "pickedUp", count: adult.pickedUp },
    { key: "rest", count: adult.rest },
    { key: "hardThrow", count: adult.hardThrow },
  ];

  categories.sort((a, b) => b.count - a.count);

  const dominant = categories[0];

  // Only add a second line if there's meaningful ongoing activity
  if (dominant.count === 0) {
    return null;
  }

  switch (dominant.key) {
    case "play":
      return `Still loves a good play session.`;
    case "pickedUp":
      return `Still enjoys being held.`;
    case "rest":
      return `Still takes plenty of cozy naps.`;
    case "hardThrow":
      return `Still loves the thrill of a wild toss.`;
    default:
      return null;
  }
}
