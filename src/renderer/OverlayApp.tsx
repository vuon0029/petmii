import { useState, useEffect, useRef, useCallback } from "react";
import { PetVariant, PetState } from "./pet/petVariant";
import { PetAvatar } from "./components/PetAvatar";
import "./styles/overlay.css";
import "./styles/pet-avatar.css";

const LOW_STAT_THRESHOLD = 25;
const DRAG_THRESHOLD_MS = 200;
const SPEECH_DISPLAY_MS = 8000; // how long the speech bubble stays visible

type PhysicsState = "idle" | "flying" | "landed" | "getting-up";

export function OverlayApp() {
  const [variant, setVariant] = useState<PetVariant | null>(null);
  const [petState, setPetState] = useState<PetState | null>(null);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [isDragging, setIsDragging] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [physicsState, setPhysicsState] = useState<PhysicsState>("idle");
  const [visibleMessage, setVisibleMessage] = useState<string | null>(null);

  const mouseDownTime = useRef<number>(0);
  const dragStarted = useRef(false);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessage = useRef<string>("");

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
      const newState = s as PetState;
      setPetState(newState);

      // Show speech bubble only when message changes
      if (newState.lastMessage && newState.lastMessage !== "~" && newState.lastMessage !== lastMessage.current) {
        lastMessage.current = newState.lastMessage;
        setVisibleMessage(newState.lastMessage);

        // Clear previous timer
        if (speechTimer.current) clearTimeout(speechTimer.current);

        // Auto-dismiss after timeout
        speechTimer.current = setTimeout(() => {
          setVisibleMessage(null);
        }, SPEECH_DISPLAY_MS);
      }
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

  const containerTransforms: string[] = [];
  if (rotation !== 0) {
    containerTransforms.push(`rotate(${rotation}deg)`);
  }

  const avatarFlip = direction === "left" && physicsState === "idle";
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
          transform: containerTransforms.length > 0 ? containerTransforms.join(" ") : undefined,
          transition: physicsState === "getting-up" ? "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)" : undefined,
        }}
      >
        {petState && physicsState === "idle" && (
          <div className="overlay-nametag">
            <span className="overlay-nametag-text">{petState.name}</span>
          </div>
        )}

        <div className="overlay-avatar-row">
          <div className="overlay-avatar-wrapper">
            {lowStats.length > 0 && physicsState === "idle" && (
              <div className="overlay-alerts">
                {lowStats.map((stat) => (
                  <span key={stat.cls} className="overlay-alert-icon">
                    {stat.icon}
                  </span>
                ))}
              </div>
            )}
            <div style={{ transform: avatarFlip ? "scaleX(-1)" : undefined }}>
              <PetAvatar
                species={variant.species}
                color={variant.color}
                personality={variant.personality}
              />
            </div>
          </div>
          {visibleMessage && physicsState === "idle" && (
            <div className="overlay-speech">
              <div className="overlay-speech-arrow"></div>
              <span>{visibleMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
