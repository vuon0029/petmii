import { useEffect } from "react";
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

  const eggClassName = hatching ? "egg hatching" : "egg";

  return (
    <div className="egg-hatch-screen">
      <h1>petmii</h1>
      <div className={eggClassName} aria-label="Egg" />
      <button onClick={onHatch} disabled={hatching}>
        Hatch Egg
      </button>
      <p>Tap to meet your new pet.</p>
    </div>
  );
}
