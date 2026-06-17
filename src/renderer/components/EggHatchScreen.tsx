import { useEffect } from "react";
import eggImage from "../assets/default_egg.png";
import "../styles/egg-hatch.css";

interface EggHatchScreenProps {
  hatching?: boolean;
  onHatch: () => void;
  onAnimationEnd?: () => void;
}

export function EggHatchScreen({ hatching = false, onHatch, onAnimationEnd }: EggHatchScreenProps) {
  useEffect(() => {
    if (!hatching || !onAnimationEnd) return;

    const timer = setTimeout(() => {
      onAnimationEnd();
    }, 2000);

    return () => clearTimeout(timer);
  }, [hatching, onAnimationEnd]);

  return (
    <div className="egg-hatch-screen">
      <h1>petmii</h1>
      <img
        src={eggImage}
        alt="Egg"
        className={`egg-img ${hatching ? "hatching" : ""}`}
      />
      <button onClick={onHatch} disabled={hatching}>
        Hatch Egg
      </button>
      <p>Tap to meet your new pet.</p>
    </div>
  );
}
