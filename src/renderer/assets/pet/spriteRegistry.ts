// Sprite registry — maps species/color/mood to statically imported sprite URLs.
// Colors: yellow, blue, pink, shiny
// Species: blob, star, frog

// blob sprites
import blobBlueIdle from "./blob/blue/idle.png";
import blobBlueAdult from "./blob/blue/adult.png";

import blobPinkIdle from "./blob/pink/idle.png";
import blobPinkAdult from "./blob/pink/adult.png";

import blobYellowIdle from "./blob/yellow/idle.png";
import blobYellowAdult from "./blob/yellow/adult.png";

import blobShinyIdle from "./blob/shiny/idle.png";
import blobShinyAdult from "./blob/shiny/adult.png";

//frog sprites
import babyYellowFrogIdle from "./frog/yellow/idle.png";
import babyBlueFrogIdle from "./frog/blue/idle.png";
import babyPinkFrogIdle from "./frog/pink/idle.png";
import babyShinyFrogIdle from "./frog/shiny/idle.png";

// Lookup: sprites[species][color][mood] = url
export const sprites: Record<string, Record<string, Record<string, string>>> = {
  blob: {
    blue: { baby: blobBlueIdle, child: blobBlueIdle, adult: blobBlueAdult },
    pink: { baby: blobPinkIdle, child: blobPinkIdle, adult: blobPinkAdult },
    yellow: {
      baby: blobYellowIdle,
      child: blobYellowIdle,
      adult: blobYellowAdult,
    },
    shiny: { baby: blobShinyIdle, child: blobShinyIdle, adult: blobShinyAdult },
  },
  frog: {
    blue: { baby: babyBlueFrogIdle, child: blobBlueIdle, adult: blobBlueAdult },
    pink: { baby: babyPinkFrogIdle, child: blobPinkIdle, adult: blobPinkAdult },
    yellow: {
      baby: babyYellowFrogIdle,
      child: blobYellowIdle,
      adult: blobYellowAdult,
    },
    shiny: {
      baby: babyShinyFrogIdle,
      child: blobShinyIdle,
      adult: blobShinyAdult,
    },
  },
};
