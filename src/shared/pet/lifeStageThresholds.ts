// src/shared/pet/lifeStageThresholds.ts
// Species life-stage timing thresholds — lives in shared so both main
// process and renderer can import without cross-boundary coupling.

import { TEST_MODE, TEST_BABY_TO_CHILD_HOURS, TEST_CHILD_TO_ADULT_HOURS } from "../testMode";

/** Pet species type (duplicated locally — shared must NOT import from renderer) */
export type PetSpecies = "blob" | "frog";

export interface SpeciesStageTiming {
  babyToChild: number; // hours
  childToAdult: number; // hours
}

/** Species life-stage timing thresholds used for evolution readiness checks */
export const SPECIES_STAGE_THRESHOLDS: Record<PetSpecies, SpeciesStageTiming> = TEST_MODE
  ? {
      blob: { babyToChild: TEST_BABY_TO_CHILD_HOURS, childToAdult: TEST_CHILD_TO_ADULT_HOURS },
      frog: { babyToChild: TEST_BABY_TO_CHILD_HOURS, childToAdult: TEST_CHILD_TO_ADULT_HOURS },
    }
  : {
      blob: { babyToChild: 24, childToAdult: 72 },
      frog: { babyToChild: 48, childToAdult: 120 },
    };

console.log("[petmii] SPECIES_STAGE_THRESHOLDS:", JSON.stringify(SPECIES_STAGE_THRESHOLDS), "TEST_MODE:", TEST_MODE);
