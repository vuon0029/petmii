// src/renderer/pet/mood.ts
// Derives pet mood from current stats.

import type { PetMood, PetState } from "./petVariant";

/**
 * Calculates the current mood based on pet stats.
 * Priority order: dead > sick > hungry > sleepy > sad > happy > playful > neutral
 */
export function deriveMood(pet: PetState): PetMood {
  if (!pet.isAlive) return "dead";
  if (pet.hp < 40) return "sick";
  if (pet.hunger < 15) return "hungry";
  if (pet.energy < 15) return "sleepy";
  if (pet.happiness < 20) return "sad";
  if (pet.happiness > 70 && pet.hunger > 50 && pet.energy > 50) return "happy";
  if (pet.happiness > 60 && pet.energy > 60) return "playful";
  return "neutral";
}

/**
 * Generates a message based on the current mood and stats.
 */
export function deriveMessage(pet: PetState): string {
  if (!pet.isAlive) return "...";

  // HP-based warnings (hidden stat but affects messaging)
  if (pet.hp < 10) return "...";
  if (pet.hp < 25) return "I'm really struggling...";
  if (pet.hp < 50) return "Please take care of me...";
  if (pet.hp < 80) return "I'm not feeling great...";

  // Stat-based messages
  if (pet.hunger < 10) return "I'm starving!";
  if (pet.hunger < 25) return "I'm so hungry...";
  if (pet.energy < 10) return "I can barely keep my eyes open...";
  if (pet.energy < 25) return "I'm exhausted...";
  if (pet.cleanliness < 15) return "I feel so dirty...";
  if (pet.happiness < 15) return "I'm so lonely...";
  if (pet.happiness < 30) return "Play with me?";

  // Happy messages
  if (pet.bond > 80 && pet.happiness > 70) return "I love being with you!";
  if (pet.happiness > 80) return "Life is wonderful!";
  if (pet.hunger > 80 && pet.happiness > 60) return "That was delicious!";

  return "~";
}
