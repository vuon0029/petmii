// Auto-generated sprite registry.
// Maps species/color/mood to statically imported sprite URLs.

// blob sprites
import blobBlueIdle from "./blob/blue/idle.png";
import blobBlueHappy from "./blob/blue/happy.png";
import blobCreamIdle from "./blob/cream/idle.png";
import blobCreamHappy from "./blob/cream/happy.png";
import blobLavenderIdle from "./blob/lavender/idle.png";
import blobLavenderHappy from "./blob/lavender/happy.png";
import blobMintIdle from "./blob/mint/idle.png";
import blobMintHappy from "./blob/mint/happy.png";
import blobPinkIdle from "./blob/pink/idle.png";
import blobPinkHappy from "./blob/pink/happy.png";
import blobYellowIdle from "./blob/yellow/idle.png";
import blobYellowHappy from "./blob/yellow/happy.png";

// Lookup: sprites[species][color][mood] = url
export const sprites: Record<string, Record<string, Record<string, string>>> = {
  blob: {
    blue: { idle: blobBlueIdle, happy: blobBlueHappy },
    cream: { idle: blobCreamIdle, happy: blobCreamHappy },
    lavender: { idle: blobLavenderIdle, happy: blobLavenderHappy },
    mint: { idle: blobMintIdle, happy: blobMintHappy },
    pink: { idle: blobPinkIdle, happy: blobPinkHappy },
    yellow: { idle: blobYellowIdle, happy: blobYellowHappy },
  },
};
