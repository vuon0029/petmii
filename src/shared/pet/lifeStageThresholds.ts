// src/shared/pet/lifeStageThresholds.ts
// Species life-stage timing thresholds — lives in shared so both main
// process and renderer can import without cross-boundary coupling.

/** Pet species type (duplicated locally — shared must NOT import from renderer) */
export type PetSpecies = "blob" | "frog";

export interface SpeciesStageTiming {
  babyToChild: number; // hours
  childToAdult: number; // hours
}

/** Species life-stage timing thresholds used for evolution readiness checks */
export const SPECIES_STAGE_THRESHOLDS: Record<PetSpecies, SpeciesStageTiming> = {
  blob: { babyToChild: 24, childToAdult: 72 }, // TESTING values — match current speciesTraits.ts
  frog: { babyToChild: 48, childToAdult: 120 }, // TESTING values — match current speciesTraits.ts
};
