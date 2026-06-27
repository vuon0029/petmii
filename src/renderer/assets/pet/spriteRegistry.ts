/**
 * Sprite registry — maps species/variantId/lifeStage/visualState to sprite entries.
 * Supports the new SpriteRegistry structure keyed by species/variantId/lifeStage/visualState
 * while maintaining backward-compatible `sprites` export for existing consumers.
 */

import type { SpriteMetadata } from "./spriteMetadata";

// --- Sprite Entry and Registry types ---

export interface SpriteEntry {
  src: string;
  metadata?: Partial<SpriteMetadata>;
}

export type SpriteRegistry = Record<
  string, // species
  Record<
    string, // variantId
    Record<
      string, // lifeStage
      Record<
        string, // visualState ("idle" | "sleep")
        SpriteEntry
      >
    >
  >
>;

// --- Blob sprite imports ---

import babyBlueBlob from "./blob/blue/baby.png";
import babyBlueBlobSleep from "./blob/blue/baby_sleep.png";
import childBlueBlob from "./blob/blue/child.png";
import childBlueBlobSleep from "./blob/blue/child_sleep.png";
import adultBlueBlob from "./blob/blue/adult.png";
import adultBlueBlobSleep from "./blob/blue/adult_sleep.png";

import babyPinkBlob from "./blob/pink/baby.png";
import babyPinkBlobSleep from "./blob/pink/baby_sleep.png";
import childPinkBlob from "./blob/pink/child.png";
import childPinkBlobSleep from "./blob/pink/child_sleep.png";
import adultPinkBlob from "./blob/pink/adult.png";
import adultPinkBlobSleep from "./blob/pink/adult_sleep.png";

import babyYellowBlob from "./blob/yellow/baby.png";
import babyYellowBlobSleep from "./blob/yellow/baby_sleep.png";
import childYellowBlob from "./blob/yellow/child.png";
import childYellowBlobSleep from "./blob/yellow/child_sleep.png";
import adultYellowBlob from "./blob/yellow/adult.png";
import adultYellowBlobSleep from "./blob/yellow/adult_sleep.png";

import babyShinyBlob from "./blob/shiny/baby.png";
import babyShinyBlobSleep from "./blob/shiny/baby_sleep.png";
import childShinyBlob from "./blob/shiny/child.png";
import childShinyBlobSleep from "./blob/shiny/child_sleep.png";
import adultShinyBlob from "./blob/shiny/adult.png";
import adultShinyBlobSleep from "./blob/shiny/adult_sleep.png";

// --- Blob dance sprite imports ---
import babyBlueBlobDance from "./blob/blue/baby_dance.png";
import childBlueBlobDance from "./blob/blue/child_dance.png";
import adultBlueBlobDance from "./blob/blue/adult_dance.png";
import babyPinkBlobDance from "./blob/pink/baby_dance.png";
import childPinkBlobDance from "./blob/pink/child_dance.png";
import adultPinkBlobDance from "./blob/pink/adult_dance.png";
import babyYellowBlobDance from "./blob/yellow/baby_dance.png";
import childYellowBlobDance from "./blob/yellow/child_dance.png";
import adultYellowBlobDance from "./blob/yellow/adult_dance.png";
import babyShinyBlobDance from "./blob/shiny/baby_dance.png";
import childShinyBlobDance from "./blob/shiny/child_dance.png";
import adultShinyBlobDance from "./blob/shiny/adult_dance.png";

// --- Frog sprite imports ---

import babyYellowFrog from "./frog/yellow/baby.png";
import babyYellowFrogSleep from "./frog/yellow/baby_sleep.png";
import childYellowFrog from "./frog/yellow/child.png";
import childYellowFrogSleep from "./frog/yellow/child_sleep.png";
import adultYellowFrog from "./frog/yellow/adult.png";
import adultYellowFrogSleep from "./frog/yellow/adult_sleep.png";

import babyBlueFrog from "./frog/blue/baby.png";
import babyBlueFrogSleep from "./frog/blue/baby_sleep.png";
import childBlueFrog from "./frog/blue/child.png";
import childBlueFrogSleep from "./frog/blue/child_sleep.png";
import adultBlueFrog from "./frog/blue/adult.png";
import adultBlueFrogSleep from "./frog/blue/adult_sleep.png";

import babyPinkFrog from "./frog/pink/baby.png";
import babyPinkFrogSleep from "./frog/pink/baby_sleep.png";
import childPinkFrog from "./frog/pink/child.png";
import childPinkFrogSleep from "./frog/pink/child_sleep.png";
import adultPinkFrog from "./frog/pink/adult.png";
import adultPinkFrogSleep from "./frog/pink/adult_sleep.png";

import babyShinyFrog from "./frog/shiny/baby.png";
import babyShinyFrogSleep from "./frog/shiny/baby_sleep.png";
import childShinyFrog from "./frog/shiny/child.png";
import childShinyFrogSleep from "./frog/shiny/child_sleep.png";
import adultShinyFrog from "./frog/shiny/adult.png";
import adultShinyFrogSleep from "./frog/shiny/adult_sleep.png";

// --- Frog dance sprite imports (no baby_dance for frogs) ---
import childYellowFrogDance from "./frog/yellow/child_dance.png";
import adultYellowFrogDance from "./frog/yellow/adult_dance.png";
import childBlueFrogDance from "./frog/blue/child_dance.png";
import adultBlueFrogDance from "./frog/blue/adult_dance.png";
import childPinkFrogDance from "./frog/pink/child_dance.png";
import adultPinkFrogDance from "./frog/pink/adult_dance.png";
import childShinyFrogDance from "./frog/shiny/child_dance.png";
import adultShinyFrogDance from "./frog/shiny/adult_dance.png";

// --- New SpriteRegistry structure (species/variantId/lifeStage/visualState) ---

export const spriteRegistry: SpriteRegistry = {
  blob: {
    blue: {
      baby: { idle: { src: babyBlueBlob }, sleep: { src: babyBlueBlobSleep, metadata: { frameCount: 9 } }, dance: { src: babyBlueBlobDance, metadata: { frameCount: 1 } } },
      child: { idle: { src: childBlueBlob }, sleep: { src: childBlueBlobSleep, metadata: { frameCount: 9 } }, dance: { src: childBlueBlobDance, metadata: { frameCount: 1 } } },
      adult: { idle: { src: adultBlueBlob, metadata: { frameCount: 9 } }, sleep: { src: adultBlueBlobSleep, metadata: { frameCount: 9 } }, dance: { src: adultBlueBlobDance, metadata: { frameCount: 1 } } },
    },
    pink: {
      baby: { idle: { src: babyPinkBlob }, sleep: { src: babyPinkBlobSleep, metadata: { frameCount: 9 } }, dance: { src: babyPinkBlobDance, metadata: { frameCount: 1 } } },
      child: { idle: { src: childPinkBlob }, sleep: { src: childPinkBlobSleep, metadata: { frameCount: 9 } }, dance: { src: childPinkBlobDance, metadata: { frameCount: 1 } } },
      adult: { idle: { src: adultPinkBlob, metadata: { frameCount: 9 } }, sleep: { src: adultPinkBlobSleep, metadata: { frameCount: 9 } }, dance: { src: adultPinkBlobDance, metadata: { frameCount: 1 } } },
    },
    yellow: {
      baby: { idle: { src: babyYellowBlob }, sleep: { src: babyYellowBlobSleep, metadata: { frameCount: 9 } }, dance: { src: babyYellowBlobDance, metadata: { frameCount: 1 } } },
      child: { idle: { src: childYellowBlob }, sleep: { src: childYellowBlobSleep, metadata: { frameCount: 9 } }, dance: { src: childYellowBlobDance, metadata: { frameCount: 1 } } },
      adult: { idle: { src: adultYellowBlob, metadata: { frameCount: 9 } }, sleep: { src: adultYellowBlobSleep, metadata: { frameCount: 9 } }, dance: { src: adultYellowBlobDance, metadata: { frameCount: 1 } } },
    },
    shiny: {
      baby: { idle: { src: babyShinyBlob }, sleep: { src: babyShinyBlobSleep, metadata: { frameCount: 9 } }, dance: { src: babyShinyBlobDance, metadata: { frameCount: 1 } } },
      child: { idle: { src: childShinyBlob }, sleep: { src: childShinyBlobSleep, metadata: { frameCount: 9 } }, dance: { src: childShinyBlobDance, metadata: { frameCount: 1 } } },
      adult: { idle: { src: adultShinyBlob, metadata: { frameCount: 9 } }, sleep: { src: adultShinyBlobSleep, metadata: { frameCount: 9 } }, dance: { src: adultShinyBlobDance, metadata: { frameCount: 1 } } },
    },
  },
  frog: {
    blue: {
      baby: { idle: { src: babyBlueFrog }, sleep: { src: babyBlueFrogSleep} },
      child: { idle: { src: childBlueFrog, metadata: { frameCount: 9 } }, sleep: { src: childBlueFrogSleep, metadata: { frameCount: 9 } }, dance: { src: childBlueFrogDance, metadata: { frameCount: 1 } } },
      adult: { idle: { src: adultBlueFrog, metadata: { frameCount: 9 } }, sleep: { src: adultBlueFrogSleep, metadata: { frameCount: 9 } }, dance: { src: adultBlueFrogDance, metadata: { frameCount: 1 } } },
    },
    pink: {
      baby: { idle: { src: babyPinkFrog }, sleep: { src: babyPinkFrogSleep } },
      child: { idle: { src: childPinkFrog, metadata: { frameCount: 9 } }, sleep: { src: childPinkFrogSleep, metadata: { frameCount: 9 } }, dance: { src: childPinkFrogDance, metadata: { frameCount: 1 } } },
      adult: { idle: { src: adultPinkFrog, metadata: { frameCount: 9 } }, sleep: { src: adultPinkFrogSleep, metadata: { frameCount: 9 } }, dance: { src: adultPinkFrogDance, metadata: { frameCount: 1 } } },
    },
    yellow: {
      baby: { idle: { src: babyYellowFrog }, sleep: { src: babyYellowFrogSleep } },
      child: { idle: { src: childYellowFrog, metadata: { frameCount: 9 } }, sleep: { src: childYellowFrogSleep, metadata: { frameCount: 9 } }, dance: { src: childYellowFrogDance, metadata: { frameCount: 1 } } },
      adult: { idle: { src: adultYellowFrog, metadata: { frameCount: 9 } }, sleep: { src: adultYellowFrogSleep, metadata: { frameCount: 9 } }, dance: { src: adultYellowFrogDance, metadata: { frameCount: 1 } } },
    },
    shiny: {
      baby: { idle: { src: babyShinyFrog }, sleep: { src: babyShinyFrogSleep } },
      child: { idle: { src: childShinyFrog, metadata: { frameCount: 9 } }, sleep: { src: childShinyFrogSleep, metadata: { frameCount: 9 } }, dance: { src: childShinyFrogDance, metadata: { frameCount: 1 } } },
      adult: { idle: { src: adultShinyFrog, metadata: { frameCount: 9 } }, sleep: { src: adultShinyFrogSleep, metadata: { frameCount: 9 } }, dance: { src: adultShinyFrogDance, metadata: { frameCount: 1 } } },
    },
  },
};

// --- Backward-compatible export ---
// Existing consumers (PetAvatar) use: sprites[species][color][lifeStage] → string
// This preserves that interface while the codebase migrates to the new registry.

export const sprites: Record<string, Record<string, Record<string, string>>> = {
  blob: {
    blue: { baby: babyBlueBlob, child: childBlueBlob, adult: adultBlueBlob },
    pink: { baby: babyPinkBlob, child: childPinkBlob, adult: adultPinkBlob },
    yellow: {
      baby: babyYellowBlob,
      child: childYellowBlob,
      adult: adultYellowBlob,
    },
    shiny: { baby: babyShinyBlob, child: childShinyBlob, adult: adultShinyBlob },
  },
  frog: {
    blue: { baby: babyBlueFrog, child: childBlueFrog, adult: adultBlueFrog },
    pink: { baby: babyPinkFrog, child: childPinkFrog, adult: adultPinkFrog },
    yellow: {
      baby: babyYellowFrog,
      child: childYellowFrog,
      adult: adultYellowFrog,
    },
    shiny: {
      baby: babyShinyFrog,
      child: childShinyFrog,
      adult: adultShinyFrog,
    },
  },
};
