// src/renderer/overlay/variantId.ts
// VariantId resolution and validation utilities for backward-compatible asset resolution.

import type { PetState } from "../pet/petVariant";

/**
 * Regex pattern for valid variantId values.
 * Must be non-empty, lowercase alphanumeric with underscores only.
 */
const VARIANT_ID_PATTERN = /^[a-z0-9_]+$/;

/**
 * Resolves the variantId for a pet, providing backward compatibility.
 * If the pet has an explicit `variantId` field, it is used directly.
 * Otherwise, the pet's `color` field is used as the variantId.
 *
 * Requirements: 4.2, 4.3
 */
export function resolveVariantId(pet: PetState): string {
  return (pet as any).variantId || pet.color;
}

/**
 * Validates whether a given string is a valid variantId.
 * A valid variantId is non-empty and contains only lowercase alphanumeric
 * characters and underscores (matches `^[a-z0-9_]+$`).
 *
 * Requirements: 4.5
 */
export function isValidVariantId(id: string): boolean {
  return VARIANT_ID_PATTERN.test(id);
}
