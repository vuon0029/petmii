import { useState, useEffect, useRef, useCallback } from "react";
import { PetVariant, PetState } from "./pet/petVariant";
import { PetAvatar } from "./components/PetAvatar";
import "./styles/overlay.css";
import "./styles/pet-avatar.css";

const LOW_STAT_THRESHOLD = 25;
const DRAG_THRESHOLD_MS = 200;

type PhysicsState = "idle" | "flying" | "landed" | "getting-up";

export function OverlayApp() {
  const [variant, setVariant] = useState<PetVariant | null>(null);
  const [petState, setPetState] = useState<PetState | null>(null);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [isDragging, setIsDragging] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [physicsState, setPhysicsState] = useState<PhysicsState>("idle");

  const mouseDownTime = useRef<number>(0);
  const dragStarted = useRef(false);

  useEffect(() => {
    async function init() {
      const saved = await window.petmiiAPI.loadPet();
      if (saved) {
        setVariant({
          species: saved.species,
          color: saved.color,
          personality: saved.personality,
        });
        setPetState(saved);
      }
    }
    init();

    window.petmiiAPI.onVariantUpdate((v) => {
      setVariant(v as PetVariant);
    });

    window.petmiiAPI.onStateUpdate((s) => {
      setPetState(s as PetState);
    });

    window.petmiiAPI.onDirectionUpdate((dir) => {
      setDirection(dir as "left" | "right");
    });

    window.petmiiAPI.onRotationUpdate((deg) => {
      setRotation(deg as number);
    });

    window.petmiiAPI.onPhysicsStateUpdate((state) => {
      setPhysicsState(state as PhysicsState);
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    mouseDownTime.current = Date.now();
    dragStarted.current = false;
    window.petmiiAPI.overlayDragStart(e.screenX, e.screenY);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (mouseDownTime.current === 0) return;

    const elapsed = Date.now() - mouseDownTime.current;
    if (elapsed >= DRAG_THRESHOLD_MS) {
      if (!dragStarted.current) {
        dragStarted.current = true;
        setIsDragging(true);
      }
      window.petmiiAPI.overlayDragMove(e.screenX, e.screenY);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    const elapsed = Date.now() - mouseDownTime.current;
    mouseDownTime.current = 0;

    if (dragStarted.current) {
      dragStarted.current = false;
      setIsDragging(false);
      window.petmiiAPI.overlayDragEnd();
    } else if (elapsed < DRAG_THRESHOLD_MS) {
      window.petmiiAPI.exitOverlayMode();
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (dragStarted.current) {
      dragStarted.current = false;
      setIsDragging(false);
      mouseDownTime.current = 0;
      window.petmiiAPI.overlayDragEnd();
    }
  }, []);

  if (!variant) return null;

  const lowStats: { icon: string; cls: string }[] = [];
  if (petState) {
    if (petState.hunger < LOW_STAT_THRESHOLD)
      lowStats.push({ icon: "🍖", cls: "overlay-stat-hunger" });
    if (petState.happiness < LOW_STAT_THRESHOLD)
      lowStats.push({ icon: "💛", cls: "overlay-stat-happiness" });
    if (petState.energy < LOW_STAT_THRESHOLD)
      lowStats.push({ icon: "⚡", cls: "overlay-stat-energy" });
  }

  // Build pet transform
  const transforms: string[] = [];
  if (direction === "left" && physicsState === "idle") {
    transforms.push("scaleX(-1)");
  }
  if (rotation !== 0) {
    transforms.push(`rotate(${rotation}deg)`);
  }

  // Determine CSS class for physics state
  const stateClass = physicsState !== "idle" ? `physics-${physicsState}` : "";

  return (
    <div
      className="overlay-container"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`overlay-pet ${stateClass} ${isDragging ? "dragging" : ""}`}
        onMouseDown={handleMouseDown}
        style={{
          transform: transforms.length > 0 ? transforms.join(" ") : undefined,
          transition: physicsState === "getting-up" ? "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)" : undefined,
        }}
      >
        {petState && physicsState === "idle" && (
          <div className="overlay-nametag">
            <span className="overlay-nametag-text">{petState.name}</span>
          </div>
        )}

        {lowStats.length > 0 && physicsState === "idle" && (
          <div className="overlay-alerts">
            {lowStats.map((stat) => (
              <span key={stat.cls} className="overlay-alert-icon">
                {stat.icon}
              </span>
            ))}
          </div>
        )}

        <PetAvatar
          species={variant.species}
          color={variant.color}
          personality={variant.personality}
        />
      </div>
    </div>
  );
}
