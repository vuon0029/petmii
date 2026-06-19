import { useState, useEffect, useRef, useCallback } from "react";
import { PetState } from "./pet/petVariant";
import { PetAvatar } from "./components/PetAvatar";
import type { GameState } from "./types";
import "./styles/overlay.css";
import "./styles/pet-avatar.css";

const PET_BASE_SIZE = 48;
const PET_SCALE = 1.5;
const PET_RENDER_SIZE = PET_BASE_SIZE * PET_SCALE; // 72
const GROUND_OFFSET_PX = 0;

const LOW_STAT_THRESHOLD = 50;
const SPEECH_DISPLAY_MS = 8000;

// Physics constants
const GRAVITY = 0.04;
const HOP_INTERVAL_MS = 3000;
const HOP_STEP_PX = 100;
const HOP_HEIGHT_PX = 30;
const HOP_DURATION_MS = 500;
const PAUSE_CHANCE = 0.6;
const BOUNCE_DAMPING = 0.2;
const WALL_BOUNCE_DAMPING = 0.2;
const DRAG_THRESHOLD_MS = 300;
const DRAG_HISTORY_SIZE = 5;
const ANGULAR_VEL_FACTOR = 0.03;
const ANGULAR_DAMPING = 0.95;
const WALL_PADDING = 4;

interface PetOverlayState {
  id: string;
  pet: PetState;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  angularVel: number;
  direction: 1 | -1;
  isHopping: boolean;
  isDragging: boolean;
  isFlying: boolean;
  isLanded: boolean;
  isGettingUp: boolean;
  message: string | null;
  messageTimer: ReturnType<typeof setTimeout> | null;
  hasFoundEgg: boolean;
  isHovered: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function OverlayApp() {
  const [pets, setPets] = useState<PetOverlayState[]>([]);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const hopTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );
  const dragState = useRef<{
    petId: string | null;
    startTime: number;
    started: boolean;
    history: { x: number; y: number; t: number }[];
  }>({ petId: null, startTime: 0, started: false, history: [] });

  function getContainerHeight() {
    return containerRef.current?.clientHeight || window.innerHeight;
  }

  function getGroundY() {
    return getContainerHeight() - PET_RENDER_SIZE - GROUND_OFFSET_PX;
  }

  function getMaxX() {
    return Math.max(0, containerWidth - PET_RENDER_SIZE);
  }

  function clampX(x: number) {
    return clamp(x, 0, getMaxX());
  }

  function clampY(y: number) {
    return clamp(y, 0, getGroundY());
  }

  // Initialize pets from game state
  useEffect(() => {
    window.petmiiAPI.onGameStateUpdate((game) => {
      const g = game as GameState;
      const overlayIds = g.settings.overlayPets;
      const livingPets = g.pets.filter((p) => p.isAlive);
      const visiblePets =
        overlayIds.length > 0
          ? livingPets.filter((p) => overlayIds.includes(p.id))
          : livingPets;

      setPets((prev) => {
        // Merge: keep existing positions for pets that are still alive
        const merged: PetOverlayState[] = [];
        for (const pet of visiblePets) {
          const existing = prev.find((p) => p.id === pet.id);
          if (existing) {
            // Update pet data but keep position/physics
            merged.push({ ...existing, pet });

            // Check for message changes
            if (
              pet.lastMessage &&
              pet.lastMessage !== "~" &&
              pet.lastMessage !== existing.pet.lastMessage
            ) {
              const idx = merged.length - 1;
              if (existing.messageTimer) clearTimeout(existing.messageTimer);
              const timer = setTimeout(() => {
                setPets((p) =>
                  p.map((pp) =>
                    pp.id === pet.id
                      ? { ...pp, message: null, messageTimer: null }
                      : pp,
                  ),
                );
              }, SPEECH_DISPLAY_MS);
              merged[idx] = {
                ...merged[idx],
                message: pet.lastMessage,
                messageTimer: timer,
              };
            }
          } else {
            // New pet — random position
            merged.push(createPetState(pet, containerWidth));
          }
        }
        return merged;
      });
    });

    // Initial load
    async function init() {
      const game = await window.petmiiAPI.loadGame();
      const overlayIds = game.settings.overlayPets;
      const livingPets = game.pets.filter((p: PetState) => p.isAlive);
      // If no overlay pets configured, show all living pets
      const visiblePets =
        overlayIds.length > 0
          ? livingPets.filter((p) => overlayIds.includes(p.id))
          : livingPets;
      setPets(
        visiblePets.map((p: PetState) => createPetState(p, window.innerWidth)),
      );
    }
    init();

    // Track container width
    const handleResize = () => setContainerWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);

    // Listen for egg found events
    window.petmiiAPI.onEggFound((data) => {
      const { finder } = data as { finder: PetState; egg: unknown };
      setPets((prev) =>
        prev.map((p) => (p.id === finder.id ? { ...p, hasFoundEgg: true } : p)),
      );
    });

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Start hopping timers for each pet
  useEffect(() => {
    // Clear old timers
    for (const timer of hopTimersRef.current.values()) {
      clearInterval(timer);
    }
    hopTimersRef.current.clear();

    for (const pet of pets) {
      if (!hopTimersRef.current.has(pet.id)) {
        const timer = setInterval(
          () => {
            triggerHop(pet.id);
          },
          HOP_INTERVAL_MS + Math.random() * 1000,
        );
        hopTimersRef.current.set(pet.id, timer);
      }
    }

    return () => {
      for (const timer of hopTimersRef.current.values()) {
        clearInterval(timer);
      }
    };
  }, [pets.map((p) => p.id).join(",")]);

  // Physics animation loop (for flying/gravity)
  useEffect(() => {
    function frame() {
      setPets((prev) => {
        let changed = false;
        const next = prev.map((p) => {
          if (!p.isFlying) return p;
          changed = true;

          let { x, y, vx, vy, rotation, angularVel } = p;
          vy += GRAVITY;
          x += vx;
          y += vy;
          rotation += angularVel;
          angularVel *= ANGULAR_DAMPING;

          // Wall bounce
          if (x <= 0) {
            x = 0;
            vx = -vx * WALL_BOUNCE_DAMPING;
            angularVel *= -0.5;
          }

          if (x >= getMaxX()) {
            x = getMaxX();
            vx = -vx * WALL_BOUNCE_DAMPING;
            angularVel *= -0.5;
          }

          // Ceiling bounce
          if (y <= 0) {
            y = 0;
            vy = -vy * BOUNCE_DAMPING;
          }

          // Ground (y >= 0 means at bottom of container - pet height - padding)
          const groundY = getGroundY();

          if (y >= groundY) {
            y = groundY;

            if (Math.abs(vy) < 2 && Math.abs(vx) < 1) {
              return {
                ...p,
                x: clampX(x),
                y: groundY,
                vx: 0,
                vy: 0,
                rotation,
                angularVel: 0,
                isFlying: false,
                isLanded: true,
              };
            }

            vy = -vy * BOUNCE_DAMPING;
            vx *= 0.85;
            angularVel *= 0.5;
          }

          return { ...p, x, y, vx, vy, rotation, angularVel };
        });

        // Handle landed → getting up transition (handled in separate useEffect)
        const final = next;

        return changed ? final : prev;
      });

      animFrameRef.current = requestAnimationFrame(frame);
    }

    animFrameRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [containerWidth]);

  // Handle landed pets getting back up
  useEffect(() => {
    const landedPets = pets.filter((p) => p.isLanded);
    for (const p of landedPets) {
      setTimeout(() => {
        setPets((prev) =>
          prev.map((pp) =>
            pp.id === p.id && pp.isLanded
              ? { ...pp, isLanded: false, isGettingUp: true }
              : pp,
          ),
        );
        setTimeout(() => {
          setPets((prev) =>
            prev.map((pp) =>
              pp.id === p.id && pp.isGettingUp
                ? { ...pp, isGettingUp: false, rotation: 0 }
                : pp,
            ),
          );
        }, 800);
      }, 1200);
    }
  }, [pets.filter((p) => p.isLanded).length]);

  function triggerHop(petId: string) {
    setPets((prev) =>
      prev.map((p) => {
        if (p.id !== petId) return p;

        if (
          p.isHopping ||
          p.isDragging ||
          p.isFlying ||
          p.isLanded ||
          p.isGettingUp
        ) {
          return p;
        }

        if (Math.random() < PAUSE_CHANCE) return p;

        const maxX = Math.max(0, containerWidth - PET_RENDER_SIZE);
        const minX = 0;

        const groundY = getGroundY();
        const currentX = clamp(p.x, minX, maxX);

        const atLeftWall = currentX <= minX + WALL_PADDING;
        const atRightWall = currentX >= maxX - WALL_PADDING;

        let dir = p.direction as 1 | -1;

        // Force pet to turn away from the wall
        if (atLeftWall) {
          dir = 1;
        } else if (atRightWall) {
          dir = -1;
        } else if (Math.random() < 0.15) {
          dir = -dir as 1 | -1;
        }

        let targetX = currentX + HOP_STEP_PX * dir;

        // If the next hop would hit a wall, flip direction and hop away instead
        if (targetX <= minX || targetX >= maxX) {
          dir = targetX <= minX ? 1 : -1;
          targetX = currentX + HOP_STEP_PX * dir;
        }

        targetX = clamp(targetX, minX, maxX);

        console.log("hop direction:", dir, "from:", currentX, "to:", targetX);

        animateHop(petId, currentX, targetX, groundY);

        return {
          ...p,
          x: currentX,
          direction: dir,
          isHopping: true,
        };
      }),
    );
  }

  function animateHop(
    petId: string,
    startX: number,
    targetX: number,
    groundY: number,
  ) {
    const startTime = Date.now();

    function frame() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / HOP_DURATION_MS, 1);

      const easedProgress =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const arcHeight = Math.sin(progress * Math.PI) * HOP_HEIGHT_PX;
      const x = startX + (targetX - startX) * easedProgress;
      const y = groundY - arcHeight;

      setPets((prev) =>
        prev.map((p) => (p.id === petId && p.isHopping ? { ...p, x, y } : p)),
      );

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        setPets((prev) =>
          prev.map((p) =>
            p.id === petId
              ? { ...p, x: targetX, y: groundY, isHopping: false }
              : p,
          ),
        );
      }
    }

    requestAnimationFrame(frame);
  }

  // ===== Drag handling =====

  // "!" stays until user dismisses by clicking it (exits to main to see eggs)
  const handleMouseDown = useCallback(
    (petId: string, e: React.MouseEvent) => {
      e.preventDefault();
      // If pet has egg notification, clicking it goes to main view (to see eggs)
      const pet = pets.find((p) => p.id === petId);
      if (pet?.hasFoundEgg) {
        setPets((prev) =>
          prev.map((p) => (p.id === petId ? { ...p, hasFoundEgg: false } : p)),
        );
        window.petmiiAPI.exitOverlayMode();
        return;
      }
      dragState.current = {
        petId,
        startTime: Date.now(),
        started: false,
        history: [{ x: e.clientX, y: e.clientY, t: Date.now() }],
      };
    },
    [pets],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const ds = dragState.current;
    if (!ds.petId) return;

    const elapsed = Date.now() - ds.startTime;
    if (elapsed >= DRAG_THRESHOLD_MS) {
      if (!ds.started) {
        ds.started = true;
        setPets((prev) =>
          prev.map((p) =>
            p.id === ds.petId
              ? { ...p, isDragging: true, isHopping: false }
              : p,
          ),
        );
      }

      // Move pet to cursor
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left - PET_RENDER_SIZE / 2;
        const y = e.clientY - rect.top - PET_RENDER_SIZE / 2;

        setPets((prev) =>
          prev.map((p) =>
            p.id === ds.petId
              ? {
                  ...p,
                  x: clampX(x),
                  y: clampY(y),
                }
              : p,
          ),
        );
      }

      ds.history.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      if (ds.history.length > DRAG_HISTORY_SIZE) ds.history.shift();
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    const ds = dragState.current;
    if (!ds.petId) return;

    if (ds.started) {
      // Calculate throw velocity
      const history = ds.history;
      let vx = 0,
        vy = 0;
      if (history.length >= 2) {
        const recent = history[history.length - 1];
        const older = history[0];
        const dt = recent.t - older.t;
        if (dt > 0) {
          vx = ((recent.x - older.x) / dt) * 16;
          vy = ((recent.y - older.y) / dt) * 16;
        }
      }

      const isThrown = Math.abs(vx) > 2 || Math.abs(vy) > 2;
      // Cap velocity to prevent extreme throws
      vx = Math.max(-15, Math.min(15, vx));
      vy = Math.max(-15, Math.min(15, vy));
      const angularVel = isThrown ? vx * ANGULAR_VEL_FACTOR : 0;

      setPets((prev) =>
        prev.map((p) =>
          p.id === ds.petId
            ? {
                ...p,
                x: clampX(p.x),
                y: clampY(p.y),
                isDragging: false,
                isFlying: true,
                vx,
                vy,
                angularVel,
              }
            : p,
        ),
      );
    } else {
      // Short click — exit overlay
      window.petmiiAPI.exitOverlayMode();
    }

    dragState.current = {
      petId: null,
      startTime: 0,
      started: false,
      history: [],
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="overlay-container"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {pets.map((p) => (
        <div
          key={p.id}
          className={`overlay-pet ${p.isDragging ? "dragging" : ""} ${p.isFlying ? "physics-flying" : ""} ${p.isLanded ? "physics-landed" : ""} ${p.isGettingUp ? "physics-getting-up" : ""}`}
          style={{
            position: "absolute",
            left: `${p.x}px`,
            top: `${p.y}px`,
            transform: p.rotation ? `rotate(${p.rotation}deg)` : undefined,
            transition: p.isGettingUp
              ? "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)"
              : undefined,
          }}
          onMouseDown={(e) => handleMouseDown(p.id, e)}
          onMouseEnter={() =>
            setPets((prev) =>
              prev.map((pp) =>
                pp.id === p.id ? { ...pp, isHovered: true } : pp,
              ),
            )
          }
          onMouseLeave={() => {
            setPets((prev) =>
              prev.map((pp) =>
                pp.id === p.id ? { ...pp, isHovered: false } : pp,
              ),
            );
          }}
        >
          {/* Nametag */}
          <div className={`overlay-nametag ${p.isHovered ? "visible" : ""}`}>
            <span className="overlay-nametag-text">{p.pet.name}</span>
          </div>

          {/* Egg found notification */}
          {!p.isFlying && !p.isLanded && p.hasFoundEgg && (
            <div className="overlay-egg-found">!</div>
          )}

          {/* Low stat alerts */}
          {
            <LowStatAlerts
              pet={p.pet}
              isFlying={p.isFlying}
              isLanded={p.isLanded}
            />
          }

          {/* Pet sprite */}
          <div className="overlay-pet-body">
            <div
              style={{
                transform:
                  p.direction === -1 && !p.isFlying ? "scaleX(-1)" : undefined,
              }}
            >
              <PetAvatar
                species={p.pet.species}
                color={p.pet.color}
                personality={p.pet.personality}
                lifeStage={p.pet.lifeStage}
              />
            </div>
          </div>

          {/* Speech bubble */}
          {p.message && !p.isFlying && !p.isLanded && (
            <div className="overlay-speech">
              <span>{p.message}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LowStatAlerts({
  pet,
  isFlying,
  isLanded,
}: {
  pet: PetState;
  isFlying: boolean;
  isLanded: boolean;
}) {
  if (isFlying || isLanded) {
    return;
  }
  const alerts: string[] = [];
  if (pet.hunger < LOW_STAT_THRESHOLD) alerts.push("🍖");
  if (pet.happiness < LOW_STAT_THRESHOLD) alerts.push("💛");
  if (pet.energy < LOW_STAT_THRESHOLD) alerts.push("⚡");
  if (alerts.length === 0) return null;

  return (
    <div className="overlay-alerts">
      {alerts.map((icon, i) => (
        <span key={i} className="overlay-alert-icon">
          {icon}
        </span>
      ))}
    </div>
  );
}

function createPetState(pet: PetState, screenWidth: number): PetOverlayState {
  const groundY = window.innerHeight - PET_RENDER_SIZE - GROUND_OFFSET_PX;

  return {
    id: pet.id,
    pet,
    x: Math.random() * Math.max(0, screenWidth - PET_RENDER_SIZE),
    y: groundY,
    vx: 0,
    vy: 0,
    rotation: 0,
    angularVel: 0,
    direction: Math.random() > 0.5 ? 1 : -1,
    isHopping: false,
    isDragging: false,
    isFlying: false,
    isLanded: false,
    isGettingUp: false,
    message: null,
    messageTimer: null,
    hasFoundEgg: false,
    isHovered: false,
  };
}
