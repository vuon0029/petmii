// Milestone thresholds (tunable constants)
export const NAMECARD_SEASONED_DAY_THRESHOLD = 90;
export const NAMECARD_LEGENDARY_DAY_THRESHOLD = 180;
export const NAMECARD_ANCIENT_DAY_THRESHOLD = 365;

export type NamecardTier = "default" | "seasoned" | "legendary" | "ancient";

export interface NamecardMilestone {
  tier: NamecardTier;
  className: string;
  adornment?: string;
}

export function computeDayNumber(hatchedAt: string, now?: number): number {
  const currentTime = now ?? Date.now();
  const hatchTime = Date.parse(hatchedAt);
  if (isNaN(hatchTime)) return 1;
  const elapsed = Math.max(0, currentTime - hatchTime);
  return Math.floor(elapsed / 86_400_000) + 1;
}

export function truncateName(name: string, maxLength: number = 16): string {
  if (name.length > maxLength) {
    return name.slice(0, maxLength) + "\u2026";
  }
  return name;
}

export function getNamecardMilestone(dayNumber: number): NamecardMilestone {
  if (dayNumber >= NAMECARD_ANCIENT_DAY_THRESHOLD) {
    return { tier: "ancient", className: "overlay-namecard--ancient", adornment: "\u2739" }; // ✹
  }
  if (dayNumber >= NAMECARD_LEGENDARY_DAY_THRESHOLD) {
    return { tier: "legendary", className: "overlay-namecard--legendary", adornment: "\u2726" }; // ✦
  }
  if (dayNumber >= NAMECARD_SEASONED_DAY_THRESHOLD) {
    return { tier: "seasoned", className: "overlay-namecard--seasoned", adornment: "\u2726" }; // ✦
  }
  return { tier: "default", className: "overlay-namecard--default" };
}
