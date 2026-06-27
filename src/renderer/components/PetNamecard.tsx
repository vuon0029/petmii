import type { PetState } from "../pet/petVariant";
import type { PhysicsState } from "../overlay/actionScheduler";
import {
  computeDayNumber,
  truncateName,
  getNamecardAssetTier,
  getNamecardMilestone,
} from "../overlay/namecardUtils";

// Namecard assets — left cap, repeatable mid, right cap per tier
import lv1Left from "../assets/namecard/lv1/left.png";
import lv1Mid from "../assets/namecard/lv1/mid.png";
import lv1Right from "../assets/namecard/lv1/right.png";

import lv90Left from "../assets/namecard/lv90/left.png";
import lv90Mid from "../assets/namecard/lv90/mid.png";
import lv90Right from "../assets/namecard/lv90/right.png";

import lv180Left from "../assets/namecard/lv180/left.png";
import lv180Mid from "../assets/namecard/lv180/mid.png";
import lv180Right from "../assets/namecard/lv180/right.png";

import lv365Left from "../assets/namecard/lv365/left.png";
import lv365Mid from "../assets/namecard/lv365/mid.png";
import lv365Right from "../assets/namecard/lv365/right.png";

import type { NamecardAssetTier } from "../overlay/namecardUtils";

const NAMECARD_ASSETS: Record<NamecardAssetTier, { left: string; mid: string; right: string }> = {
  lv1: { left: lv1Left, mid: lv1Mid, right: lv1Right },
  lv90: { left: lv90Left, mid: lv90Mid, right: lv90Right },
  lv180: { left: lv180Left, mid: lv180Mid, right: lv180Right },
  lv365: { left: lv365Left, mid: lv365Mid, right: lv365Right },
};

const NAMECARD_HEIGHT = 30;

export interface PetNamecardProps {
  pet: PetState;
  isHovered: boolean;
  physicsState: PhysicsState;
}

export function PetNamecard({
  pet,
  isHovered,
  physicsState,
}: PetNamecardProps): JSX.Element | null {
  // Hidden during active physics states
  if (physicsState === "dragging" || physicsState === "flying" || physicsState === "landed") {
    return null;
  }

  // Hidden when not hovered
  if (!isHovered) {
    return null;
  }

  const truncatedName = truncateName(pet.name);
  const dayNumber = computeDayNumber(pet.hatchedAt);
  const tier = getNamecardAssetTier(dayNumber);
  const assets = NAMECARD_ASSETS[tier];
  const milestone = getNamecardMilestone(dayNumber);

  const label = `${milestone.adornment ? milestone.adornment + " " : ""}${truncatedName} · Day ${dayNumber}${milestone.adornment ? " " + milestone.adornment : ""}`;
  const labelClassName = tier === "lv1"
    ? "overlay-namecard-label overlay-namecard-label--dark"
    : "overlay-namecard-label";

  return (
    <div className="overlay-nametag visible" style={{ pointerEvents: "none" }}>
      <div
        className={`overlay-namecard-container ${milestone.className}`}
        style={{
          display: "flex",
          alignItems: "center",
          height: `${NAMECARD_HEIGHT}px`,
          position: "relative",
        }}
      >
        {/* Left cap */}
        <img
          src={assets.left}
          alt=""
          style={{ height: `${NAMECARD_HEIGHT}px`, width: "auto", display: "block" }}
          draggable={false}
        />
        {/* Repeating middle section */}
        <div
          style={{
            height: `${NAMECARD_HEIGHT}px`,
            backgroundImage: `url(${assets.mid})`,
            backgroundRepeat: "repeat-x",
            backgroundSize: `auto ${NAMECARD_HEIGHT}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: 2,
            paddingRight: 2,
          }}
        >
          <span className={labelClassName}>{label}</span>
        </div>
        {/* Right cap */}
        <img
          src={assets.right}
          alt=""
          style={{ height: `${NAMECARD_HEIGHT}px`, width: "auto", display: "block" }}
          draggable={false}
        />
      </div>
    </div>
  );
}
