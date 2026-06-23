import { useState, useEffect, useRef, useCallback } from "react";
import { PetState } from "./pet/petVariant";
import { PetAvatar } from "./components/PetAvatar";
import type { GameState } from "./types";
import { ActionName, MovementProfile, MOVEMENT_PROFILES, ACTION_DEFINITIONS, GLOBAL_DEFAULT_PROFILE } from "./overlay/movementProfiles";
import { createActionScheduler, destroyActionScheduler, ActionSchedulerState, PhysicsState } from "./overlay/actionScheduler";
import { animateMovementAction } from "./overlay/movementController";
import { resolveProfile, computeResolvedRestY } from "./overlay/profileResolver";
import { resolveVariantId } from "./overlay/variantId";
import { createCursorAttractionController, destroyCursorAttractionController, notifyApproachEnded, resolveApproachAmbientAction, computeSlotOffsetY, CursorAttractionState, CursorAttractionDeps, MOUSE_ATTRACT_SPEED_MULTIPLIER, MOUSE_ATTRACT_PAUSE_MULTIPLIER } from "./overlay/cursorAttractionController";
import { getEligibleBlockers, checkOverlap, computeApproachStopX, BoundingBox, resolveCollision, detectHeadBump, validatePlayPositions, correctSpawnOverlap, COLLISION_BUFFER_PX } from "./overlay/collisionDetector";
import { createAutonomousActionController, destroyAutonomousActionController, notifyAutonomousRestEnded, notifyPlayTogetherEnded, computeFacingDirections, generatePlaySpacing, selectPlayIcon, AutonomousActionState } from "./overlay/autonomousActionController";
import { getCursorPos } from "./overlay/getCursorPos";
import { shouldCountPickup } from "./overlay/pickedUpTracker";
import { classifyRelease, onWallCollision, createThrowSequenceState, ThrowSequenceState } from "./overlay/throwTracker";
import { computeEvolutionStyles, isMidpoint, EVOLUTION_DURATION_MS } from "./overlay/evolutionAnimation";
import type { EvolutionAnimationState } from "./overlay/evolutionAnimation";
import { THROW_SPEED_THRESHOLD } from "../shared/pet/careConstants";
import type { LifecycleState } from "../shared/pet/careHistory";
import { PetNamecard } from "./components/PetNamecard";
import "./styles/overlay.css";
import "./styles/pet-avatar.css";

const PET_BASE_SIZE = 48;
const DEFAULT_PET_SCALE = 1.5;
const GROUND_OFFSET_PX = 0;

const LOW_STAT_THRESHOLD = 50;
const SPEECH_DISPLAY_MS = 8000;
const REST_ACTION_DURATION_MS = 30000;

// Physics constants
const GRAVITY = 0.04;
const BOUNCE_DAMPING = 0.2;
const WALL_BOUNCE_DAMPING = 0.2;
const DRAG_HISTORY_SIZE = 5;
const ANGULAR_VEL_FACTOR = 0.03;
const ANGULAR_DAMPING = 0.95;
const WALL_PADDING = 4;
const AIR_RELEASE_THRESHOLD_PX = 40;

export type VisualState = "idle" | "sleep";

export interface PetOverlayState {
  id: string;
  pet: PetState;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  angularVel: number;
  direction: 1 | -1;
  currentAction: ActionName;
  physicsState: PhysicsState;
  visualState: VisualState;
  lifecycleState: LifecycleState;
  resolvedProfile: MovementProfile;
  restTimer: ReturnType<typeof setTimeout> | null;
  message: string | null;
  messageTimer: ReturnType<typeof setTimeout> | null;
  hasFoundEgg: boolean;
  isHovered: boolean;
  isLeaving: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Extracts the translateY pixel value from a transform string like "translateY(-30px) scale(1.05)" */
function parseTranslateY(transform: string): number {
  const match = transform.match(/translateY\(([^)]+)px\)/);
  return match ? parseFloat(match[1]) : 0;
}

/** Extracts the scale value from a transform string like "translateY(-30px) scale(1.05)" */
function parseScaleFromTransform(transform: string): number {
  const match = transform.match(/scale\(([^)]+)\)/);
  return match ? parseFloat(match[1]) : 1;
}

export function OverlayApp() {
  const [pets, setPets] = useState<PetOverlayState[]>([]);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  const [petScale, setPetScale] = useState(DEFAULT_PET_SCALE);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const schedulersRef = useRef<Map<string, ActionSchedulerState>>(new Map());
  const movementCancelRef = useRef<Map<string, () => void>>(new Map());
  const pendingRestRef = useRef<Set<string>>(new Set());
  const petsRef = useRef<PetOverlayState[]>([]);
  petsRef.current = pets;
  const petScaleRef = useRef(DEFAULT_PET_SCALE);
  petScaleRef.current = petScale;
  const dragState = useRef<{
    petId: string | null;
    startTime: number;
    started: boolean;
    history: { x: number; y: number; t: number }[];
  }>({ petId: null, startTime: 0, started: false, history: [] });
  const throwSequenceRef = useRef<ThrowSequenceState | null>(null);
  const evolutionAnimRef = useRef<EvolutionAnimationState | null>(null);
  const evolutionFrameRef = useRef<number>(0);
  const autonomousActionRef = useRef<AutonomousActionState | null>(null);
  const [playTogetherIcon, setPlayTogetherIcon] = useState<string | null>(null);
  const playBurstTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [burstingPets, setBurstingPets] = useState<Set<string>>(new Set());

  function getContainerHeight() {
    return containerRef.current?.clientHeight || window.innerHeight;
  }

  function getPetRenderSize() {
    return PET_BASE_SIZE * petScaleRef.current;
  }

  function getGroundY() {
    return getContainerHeight() - getPetRenderSize() - GROUND_OFFSET_PX;
  }

  function getMaxX() {
    return Math.max(0, containerWidth - getPetRenderSize());
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

      // Update pet scale if changed
      const newScale = g.settings.petScale ?? DEFAULT_PET_SCALE;
      if (newScale !== petScaleRef.current) {
        setPetScale(newScale);
      }

      setPets((prev) => {
        // Merge: keep existing positions for pets that are still alive
        const merged: PetOverlayState[] = [];
        const visibleIds = new Set(visiblePets.map(p => p.id));

        // Mark pets that are no longer in the list as leaving
        for (const existing of prev) {
          if (!visibleIds.has(existing.id) && !existing.isLeaving) {
            merged.push({ ...existing, isLeaving: true });
          }
        }

        for (const pet of visiblePets) {
          const existing = prev.find((p) => p.id === pet.id);
          if (existing) {
            // Update pet data but keep position/physics
            // Re-resolve profile if lifeStage changed (evolution)
            const lifeStageChanged = pet.lifeStage !== existing.pet.lifeStage;
            const updatedProfile = lifeStageChanged
              ? resolveProfile(pet.species, pet.lifeStage, MOVEMENT_PROFILES)
              : existing.resolvedProfile;
            merged.push({ ...existing, pet, resolvedProfile: updatedProfile });

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
            const newPetState = createPetState(pet, containerWidth, petScaleRef.current);
            const renderSize = PET_BASE_SIZE * petScaleRef.current;

            // Check overlap against all existing idle pets in merged
            for (let i = 0; i < merged.length; i++) {
              const existing = merged[i];
              if (existing.physicsState !== "idle") continue;

              // Edge-to-edge distance check
              const leftX = Math.min(newPetState.x, existing.x);
              const rightX = Math.max(newPetState.x, existing.x);
              const edgeToEdge = rightX - leftX - renderSize;

              if (edgeToEdge < COLLISION_BUFFER_PX) {
                // Overlap detected — correct spawn positions
                const corrected = correctSpawnOverlap(
                  newPetState.x,
                  existing.x,
                  renderSize,
                  0,
                  containerWidth,
                );
                newPetState.x = corrected.pet1X;
                merged[i] = { ...existing, x: corrected.pet2X };
              }
            }

            merged.push(newPetState);
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
      // Apply persisted pet scale
      const savedScale = game.settings.petScale ?? DEFAULT_PET_SCALE;
      setPetScale(savedScale);

      // Create all pet states and correct any spawn overlaps
      const initialPets: PetOverlayState[] = [];
      const renderSize = PET_BASE_SIZE * savedScale;
      for (const p of visiblePets) {
        const newPet = createPetState(p, window.innerWidth, savedScale);

        // Check overlap against all previously placed pets
        for (let i = 0; i < initialPets.length; i++) {
          const existing = initialPets[i];
          if (existing.physicsState !== "idle") continue;

          const leftX = Math.min(newPet.x, existing.x);
          const rightX = Math.max(newPet.x, existing.x);
          const edgeToEdge = rightX - leftX - renderSize;

          if (edgeToEdge < COLLISION_BUFFER_PX) {
            const corrected = correctSpawnOverlap(
              newPet.x,
              existing.x,
              renderSize,
              0,
              window.innerWidth,
            );
            newPet.x = corrected.pet1X;
            initialPets[i] = { ...existing, x: corrected.pet2X };
          }
        }

        initialPets.push(newPet);
      }
      setPets(initialPets);
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

    // Listen for egg notification clear signal (from main window when Eggs tab is viewed)
    window.petmiiAPI.onClearEggNotifications(() => {
      setPets((prev) => prev.map((p) => ({ ...p, hasFoundEgg: false })));
    });

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Evolution animation loop — updates pet position in state every frame for smooth movement
  function startEvolutionLoop() {
    function frame() {
      const state = evolutionAnimRef.current;
      if (!state) return;

      const elapsed = Date.now() - state.startedAt;

      // Check midpoint — fire once to commit lifeStage
      if (!state.midpointFired && isMidpoint(elapsed)) {
        state.midpointFired = true;
        window.petmiiAPI.evolveMidpoint({ petId: state.petId, sessionId: state.sessionId });
      }

      // Check completion
      if (elapsed >= EVOLUTION_DURATION_MS) {
        // Animation complete — restore normal state, pet y is already at ground from descending
        setPets(prev => prev.map(p => {
          if (p.id !== state.petId) return p;
          const groundY = getGroundY();
          const restY = computeResolvedRestY(groundY, p.resolvedProfile);
          return { ...p, lifecycleState: "normal" as LifecycleState, y: restY };
        }));
        evolutionAnimRef.current = null;
        return;
      }

      // Update pet y position and trigger re-render every frame
      const styles = computeEvolutionStyles(elapsed);
      setPets(prev => prev.map(p => {
        if (p.id !== state.petId) return p;
        // Store the base rest Y so we can offset from it
        const groundY = getGroundY();
        const restY = computeResolvedRestY(groundY, p.resolvedProfile);
        // Parse the translateY value from the transform string
        const yOffset = parseTranslateY(styles.transform);
        return { ...p, y: restY + yOffset };
      }));

      // Continue loop
      evolutionFrameRef.current = requestAnimationFrame(frame);
    }

    evolutionFrameRef.current = requestAnimationFrame(frame);
  }

  // Listen for evolve:start IPC from the main process
  useEffect(() => {
    window.petmiiAPI.onEvolveStart((data) => {
      const { petId, sessionId } = data as { petId: string; sessionId: string; targetStage: string };

      // Set pet's lifecycleState to "evolving"
      setPets(prev => prev.map(p =>
        p.id === petId ? { ...p, lifecycleState: "evolving" as LifecycleState } : p
      ));

      // Cancel any autonomous action for this pet
      const evolvingPet = petsRef.current.find(p => p.id === petId);
      if (evolvingPet?.currentAction === "autonomousRest") {
        cancelAutonomousRest(petId);
      }
      if (evolvingPet?.currentAction === "playTogether") {
        cancelPlayTogether(petId);
      }

      // Start evolution animation state
      evolutionAnimRef.current = {
        petId,
        sessionId,
        phase: "rising",
        startedAt: Date.now(),
        midpointFired: false,
      };

      // Start the animation frame loop
      startEvolutionLoop();
    });

    return () => {
      cancelAnimationFrame(evolutionFrameRef.current);
    };
  }, []);

  // Remove pets after leave animation completes
  useEffect(() => {
    const leavingPets = pets.filter(p => p.isLeaving);
    for (const p of leavingPets) {
      setTimeout(() => {
        setPets(prev => prev.filter(pp => pp.id !== p.id));
      }, 1200); // matches animation duration
    }
  }, [pets.filter(p => p.isLeaving).length]);

  // Action scheduler setup for each pet
  useEffect(() => {
    const currentPetIds = new Set(pets.map(p => p.id));

    // Destroy schedulers for removed pets
    for (const [petId, scheduler] of schedulersRef.current.entries()) {
      if (!currentPetIds.has(petId)) {
        destroyActionScheduler(scheduler);
        schedulersRef.current.delete(petId);
        // Cancel any in-progress movement for removed pet
        const cancel = movementCancelRef.current.get(petId);
        if (cancel) {
          cancel();
          movementCancelRef.current.delete(petId);
        }
        // If removed pet had an active approach, release the slot in the controller
        if (cursorAttractionRef.current?.activePetIds.has(petId)) {
          notifyApproachEnded(cursorAttractionRef.current, petId);
        }
      }
    }

    // Create schedulers for new pets
    for (const pet of pets) {
      if (!schedulersRef.current.has(pet.id)) {
        const petId = pet.id;

        const scheduler = createActionScheduler(
          petId,
          () => petsRef.current.find(p => p.id === petId)?.resolvedProfile ?? GLOBAL_DEFAULT_PROFILE,
          () => petsRef.current.find(p => p.id === petId)?.physicsState ?? "idle",
          () => petsRef.current.find(p => p.id === petId)?.currentAction ?? "idle",
          (action: ActionName) => {
            // Skip dispatching actions for evolving pets
            const pet = petsRef.current.find(p => p.id === petId);
            if (pet?.lifecycleState === "evolving") return;

            // Skip dispatching if pet is in a non-ambient action (rest, autonomousRest, playTogether, approachCursor)
            const nonAmbientActions: ActionName[] = ["rest", "autonomousRest", "playTogether", "approachCursor"];
            if (pet && nonAmbientActions.includes(pet.currentAction)) return;

            if (action === "idle") {
              setPets(prev => prev.map(p =>
                p.id === petId ? { ...p, currentAction: "idle" as ActionName } : p
              ));
              return;
            }

            const actionDef = ACTION_DEFINITIONS[action];
            if (!actionDef) {
              // Unknown action name — ignore gracefully, don't crash
              return;
            }
            if (actionDef.category === "movement") {
              dispatchMovementAction(petId, action);
            } else {
              // Stationary action (bounce, squish, idle, etc.) — just set currentAction, no position change
              setPets(prev => prev.map(p =>
                p.id === petId ? { ...p, currentAction: action } : p
              ));
            }
          }
        );

        schedulersRef.current.set(petId, scheduler);
      }
    }

    return () => {
      // Cleanup all schedulers on unmount
      for (const scheduler of schedulersRef.current.values()) {
        destroyActionScheduler(scheduler);
      }
      schedulersRef.current.clear();
      // Cancel all in-progress movements
      for (const cancel of movementCancelRef.current.values()) {
        cancel();
      }
      movementCancelRef.current.clear();
    };
  }, [pets.map((p) => p.id).join(",")]);

  // Cursor attraction controller
  const cursorPosRef = useRef<{ x: number; y: number } | null>(null);
  const cursorAttractionRef = useRef<CursorAttractionState | null>(null);

  useEffect(() => {
    // Poll cursor position via IPC every 200ms and cache in ref
    const cursorPollTimer = setInterval(async () => {
      const pos = await getCursorPos();
      cursorPosRef.current = pos;
    }, 200);

    const ARRIVAL_THRESHOLD_PX = 5;

    // Approach step loop: iteratively animate one step at a time toward the target
    function startApproachLoop(petId: string, targetX: number, targetY: number) {
      let firstStep = true;

      const executeStep = () => {
        const pet = petsRef.current.find(p => p.id === petId);
        if (!pet) return;
        // On the first step, skip the currentAction guard because setPets
        // may not have flushed yet. On subsequent steps, verify the pet is
        // still in approachCursor (could have been cancelled mid-loop).
        if (!firstStep && pet.currentAction !== "approachCursor") return;
        firstStep = false;

        const profile = pet.resolvedProfile;
        const groundY = getGroundY();

        // Compute the Y coordinate for this pet's approach
        let approachY: number;
        if (profile.movementStyle === "floating") {
          const hoverOffsetY = profile.hoverOffsetY ?? 0;
          approachY = groundY - hoverOffsetY + computeSlotOffsetY(0);
        } else {
          approachY = computeResolvedRestY(groundY, profile);
        }

        const dx = targetX - pet.x;

        // Check arrival
        if (Math.abs(dx) <= ARRIVAL_THRESHOLD_PX) {
          // Snap to target, set idle, notify controller
          setPets(prev => prev.map(p =>
            p.id === petId ? { ...p, x: targetX, y: approachY, currentAction: "idle" as ActionName } : p
          ));
          movementCancelRef.current.delete(petId);
          if (cursorAttractionRef.current) {
            const deps: CursorAttractionDeps = {
              getCursorPos: () => cursorPosRef.current,
              getPets: () => petsRef.current,
              getViewportWidth: () => window.innerWidth,
              getGroundY: () => getGroundY(),
              dispatchApproach: dispatchApproachFn,
              cancelApproach: cancelApproachFn,
            };
            notifyApproachEnded(cursorAttractionRef.current, petId, deps);
          }
          return;
        }

        // Determine step direction and distance
        const dir: 1 | -1 = dx > 0 ? 1 : -1;
        const stepDist = Math.min(profile.stepDistance, Math.abs(dx));
        let stepTargetX = pet.x + stepDist * dir;

        // ─── Collision check before approach step ───
        // Validate step target against eligible blockers (only "idle" pets)
        const petSize = getPetRenderSize();
        const blockers = getEligibleBlockers(
          petsRef.current,
          petId,
          "ground",
          petSize,
        );

        if (blockers.length > 0) {
          const proposedBox: BoundingBox = {
            x: stepTargetX,
            y: approachY,
            width: petSize,
            height: petSize,
          };
          const overlapResult = checkOverlap(proposedBox, blockers);

          if (overlapResult.collides && overlapResult.blockingBox) {
            // Stop at the buffer boundary using computeApproachStopX
            const stopX = computeApproachStopX(dir, overlapResult.blockingBox, petSize);

            // Only use stopX if it represents meaningful progress toward the target
            // (i.e., stop position is between current position and the blocker)
            const wouldMoveForward = dir === 1
              ? (stopX > pet.x + ARRIVAL_THRESHOLD_PX)
              : (stopX < pet.x - ARRIVAL_THRESHOLD_PX);

            if (wouldMoveForward) {
              stepTargetX = stopX;
            } else {
              // Cannot advance further — retry on next movement cycle
              // in case the blocker has moved away
              setTimeout(() => {
                executeStep();
              }, Math.max(profile.duration / MOUSE_ATTRACT_SPEED_MULTIPLIER, 50) + profile.landingPauseMs);
              return;
            }
          }
        }

        // Update direction for this step
        setPets(prev => prev.map(p =>
          p.id === petId ? { ...p, direction: dir } : p
        ));

        // Animate one step using the resolved approach action's movement style
        const cancel = animateMovementAction(
          {
            startX: pet.x,
            startY: approachY,
            targetX: stepTargetX,
            targetY: approachY,
            duration: Math.max(profile.duration / MOUSE_ATTRACT_SPEED_MULTIPLIER, 50),
            hopHeight: profile.hopHeight,
            landingPauseMs: Math.round(profile.landingPauseMs / MOUSE_ATTRACT_PAUSE_MULTIPLIER),
            movementStyle: profile.movementStyle,
          },
          (x: number, y: number) => {
            // onFrame: update position — always apply during approach loop
            // The loop is only active while the pet is in approachCursor,
            // so we don't need to re-check currentAction here.
            setPets(prev => prev.map(p =>
              p.id === petId
                ? { ...p, x, y }
                : p
            ));
          },
          () => {
            // onComplete: schedule next step
            movementCancelRef.current.delete(petId);
            executeStep();
          }
        );

        movementCancelRef.current.set(petId, cancel);
      };

      executeStep();
    }

    // dispatchApproach callback — sets currentAction, direction, and starts the approach loop
    function dispatchApproachFn(petId: string, targetX: number, targetY: number) {
      const pet = petsRef.current.find(p => p.id === petId);
      if (!pet) return;

      // Cancel autonomousRest if active
      if (pet.currentAction === "autonomousRest") {
        cancelAutonomousRest(petId);
      }
      // Cancel playTogether if active
      if (pet.currentAction === "playTogether") {
        cancelPlayTogether(petId);
      }

      // Compute direction based on target vs current X
      const dir: 1 | -1 = targetX >= pet.x ? 1 : -1;

      // Show a bubble message when the pet notices the cursor
      if (pet.messageTimer) clearTimeout(pet.messageTimer);
      const msgTimer = setTimeout(() => {
        setPets(prev => prev.map(p =>
          p.id === petId ? { ...p, message: null, messageTimer: null } : p
        ));
      }, 2000);

      // Set currentAction to "approachCursor", update direction, and show bubble
      setPets(prev => prev.map(p =>
        p.id === petId ? { ...p, currentAction: "approachCursor" as ActionName, direction: dir, message: "!", messageTimer: msgTimer } : p
      ));

      // Cancel any existing movement animation for this pet
      const existingCancel = movementCancelRef.current.get(petId);
      if (existingCancel) {
        existingCancel();
        movementCancelRef.current.delete(petId);
      }

      // Start the iterative approach loop
      startApproachLoop(petId, targetX, targetY);
    }

    // cancelApproach callback — cancels animation, sets idle, notifies controller
    function cancelApproachFn(petId: string) {
      // Cancel stored animation from movementCancelRef
      const cancelFn = movementCancelRef.current.get(petId);
      if (cancelFn) {
        cancelFn();
        movementCancelRef.current.delete(petId);
      }

      // Set currentAction to "idle" — do NOT modify physicsState
      setPets(prev => prev.map(p =>
        p.id === petId ? { ...p, currentAction: "idle" as ActionName } : p
      ));

      // Notify controller to release slot and record cooldown
      if (cursorAttractionRef.current) {
        const deps: CursorAttractionDeps = {
          getCursorPos: () => cursorPosRef.current,
          getPets: () => petsRef.current,
          getViewportWidth: () => window.innerWidth,
          getGroundY: () => getGroundY(),
          dispatchApproach: dispatchApproachFn,
          cancelApproach: cancelApproachFn,
        };
        notifyApproachEnded(cursorAttractionRef.current, petId, deps);
      }
    }

    // Create the cursor attraction controller
    const controllerState = createCursorAttractionController({
      getCursorPos: () => cursorPosRef.current,
      getPets: () => petsRef.current,
      getViewportWidth: () => window.innerWidth,
      getGroundY: () => getGroundY(),
      dispatchApproach: dispatchApproachFn,
      cancelApproach: cancelApproachFn,
    });

    cursorAttractionRef.current = controllerState;

    return () => {
      clearInterval(cursorPollTimer);
      destroyCursorAttractionController(controllerState);
      cursorAttractionRef.current = null;
    };
  }, []);

  // Autonomous action controller — dispatch/end functions
  function dispatchAutonomousRestFn(petId: string, durationMs: number) {
    const pet = petsRef.current.find(p => p.id === petId);
    if (!pet) return;
    if (pet.physicsState !== "idle" || pet.currentAction !== "idle") return;

    const restY = computeResolvedRestY(getGroundY(), pet.resolvedProfile);

    setPets(prev => prev.map(p =>
      p.id === petId
        ? { ...p, currentAction: "autonomousRest" as ActionName, visualState: "sleep" as VisualState, y: restY }
        : p
    ));

    window.petmiiAPI.sendAutonomousActionStarted({ petId, action: "autonomousRest", durationMs });
  }

  async function endAutonomousRestFn(petId: string) {
    const pet = petsRef.current.find(p => p.id === petId);
    if (!pet || pet.currentAction !== "autonomousRest") return;

    // Apply 50% rest benefit
    const updatedPetData = applyAutonomousRestAction(pet.pet);
    await window.petmiiAPI.savePet(updatedPetData);

    setPets(prev => prev.map(p =>
      p.id === petId
        ? { ...p, currentAction: "idle" as ActionName, visualState: "idle" as VisualState, pet: updatedPetData }
        : p
    ));

    window.petmiiAPI.sendAutonomousActionEnded({ petId, action: "autonomousRest" });

    if (autonomousActionRef.current) {
      notifyAutonomousRestEnded(autonomousActionRef.current, petId);
    }
  }

  function dispatchPlayTogetherFn(petId1: string, petId2: string, durationMs: number) {
    const pet1 = petsRef.current.find(p => p.id === petId1);
    const pet2 = petsRef.current.find(p => p.id === petId2);
    if (!pet1 || !pet2) return;
    if (pet1.physicsState !== "idle" || pet1.currentAction !== "idle") return;
    if (pet2.physicsState !== "idle" || pet2.currentAction !== "idle") return;

    // Compute meeting position — nudge pets close together within radius
    const spacing = generatePlaySpacing(); // 20-50px random gap
    const midX = (pet1.x + pet2.x) / 2;
    const maxX = getMaxX();
    const petWidth = getPetRenderSize();
    let pet1X = clamp(midX - spacing / 2, 0, maxX);
    let pet2X = clamp(midX + spacing / 2, 0, maxX);

    // Validate play positions for spacing and viewport bounds
    const validated = validatePlayPositions(pet1X, pet2X, petWidth, containerWidth, 50, 80);
    if (validated.cancelled) {
      // Viewport too narrow — abort play-together, leave both pets in their prior state
      return;
    }
    pet1X = validated.pet1X;
    pet2X = validated.pet2X;

    // Compute ground Y for both
    const groundY = getGroundY();
    const pet1Y = computeResolvedRestY(groundY, pet1.resolvedProfile);
    const pet2Y = computeResolvedRestY(groundY, pet2.resolvedProfile);

    // Compute facing based on final positions
    const { dir1, dir2 } = computeFacingDirections(pet1X, pet2X);

    setPets(prev => prev.map(p => {
      if (p.id === petId1) return { ...p, currentAction: "playTogether" as ActionName, visualState: "idle" as VisualState, direction: dir1, x: pet1X, y: pet1Y };
      if (p.id === petId2) return { ...p, currentAction: "playTogether" as ActionName, visualState: "idle" as VisualState, direction: dir2, x: pet2X, y: pet2Y };
      return p;
    }));

    setPlayTogetherIcon(selectPlayIcon());
    startPlayBursts(petId1, petId2);

    window.petmiiAPI.sendAutonomousActionStarted({ petId: petId1, action: "playTogether", durationMs });
    window.petmiiAPI.sendAutonomousActionStarted({ petId: petId2, action: "playTogether", durationMs });
  }

  async function endPlayTogetherFn(petId1: string, petId2: string) {
    const pet1 = petsRef.current.find(p => p.id === petId1);
    const pet2 = petsRef.current.find(p => p.id === petId2);

    // Apply 50% play benefits to both pets
    const updatedPet1Data = pet1 && pet1.currentAction === "playTogether" ? applyAutonomousPlayAction(pet1.pet) : null;
    const updatedPet2Data = pet2 && pet2.currentAction === "playTogether" ? applyAutonomousPlayAction(pet2.pet) : null;

    if (updatedPet1Data) await window.petmiiAPI.savePet(updatedPet1Data);
    if (updatedPet2Data) await window.petmiiAPI.savePet(updatedPet2Data);

    setPets(prev => prev.map(p => {
      if (p.id === petId1 && p.currentAction === "playTogether") {
        return { ...p, currentAction: "idle" as ActionName, visualState: "idle" as VisualState, ...(updatedPet1Data ? { pet: updatedPet1Data } : {}) };
      }
      if (p.id === petId2 && p.currentAction === "playTogether") {
        return { ...p, currentAction: "idle" as ActionName, visualState: "idle" as VisualState, ...(updatedPet2Data ? { pet: updatedPet2Data } : {}) };
      }
      return p;
    }));

    setPlayTogetherIcon(null);
    stopPlayBursts();

    window.petmiiAPI.sendAutonomousActionEnded({ petId: petId1, action: "playTogether" });
    window.petmiiAPI.sendAutonomousActionEnded({ petId: petId2, action: "playTogether" });

    if (autonomousActionRef.current) {
      notifyPlayTogetherEnded(autonomousActionRef.current, petId1, petId2);
    }
  }

  // Helper: cancel autonomousRest for a specific pet
  function cancelAutonomousRest(petId: string) {
    if (!autonomousActionRef.current) return;
    const state = autonomousActionRef.current;

    // Clear the duration timer owned by the controller
    const timer = state.activeRest.get(petId);
    if (timer) {
      clearTimeout(timer);
    }

    // Reset pet state to idle
    setPets(prev => prev.map(p =>
      p.id === petId && p.currentAction === "autonomousRest"
        ? { ...p, currentAction: "idle" as ActionName, visualState: "idle" as VisualState }
        : p
    ));

    window.petmiiAPI.sendAutonomousActionEnded({ petId, action: "autonomousRest" });

    // Notify controller to record cooldown and clean up tracking
    notifyAutonomousRestEnded(state, petId);
  }

  // Helper: cancel playTogether session (affects BOTH pets)
  function cancelPlayTogether(petId: string) {
    if (!autonomousActionRef.current) return;
    const state = autonomousActionRef.current;
    const session = state.activePlaySession;
    if (!session) return;

    // Only cancel if the given pet is part of this session
    if (session.petId1 !== petId && session.petId2 !== petId) return;

    // Clear the duration timer
    clearTimeout(session.durationTimer);

    // Reset both pets to idle
    setPets(prev => prev.map(p => {
      if ((p.id === session.petId1 || p.id === session.petId2) && p.currentAction === "playTogether") {
        return { ...p, currentAction: "idle" as ActionName, visualState: "idle" as VisualState };
      }
      return p;
    }));

    setPlayTogetherIcon(null);
    stopPlayBursts();

    window.petmiiAPI.sendAutonomousActionEnded({ petId: session.petId1, action: "playTogether" });
    window.petmiiAPI.sendAutonomousActionEnded({ petId: session.petId2, action: "playTogether" });

    // Notify controller
    notifyPlayTogetherEnded(state, session.petId1, session.petId2);
  }

  // ─── playTogether burst animation helpers ───

  function startPlayBursts(petId1: string, petId2: string) {
    // Schedule independent random bursts for each pet
    scheduleBurst(petId1);
    scheduleBurst(petId2);
  }

  function scheduleBurst(petId: string) {
    // Random delay before next burst: 800-2500ms
    const delay = Math.floor(Math.random() * 1700) + 800;
    const timer = setTimeout(() => {
      // Check if pet is still in playTogether
      const pet = petsRef.current.find(p => p.id === petId);
      if (!pet || pet.currentAction !== "playTogether") {
        playBurstTimersRef.current.delete(petId);
        return;
      }
      // Trigger burst
      setBurstingPets(prev => new Set(prev).add(petId));
      // Remove burst class after animation duration (500ms)
      const clearTimer = setTimeout(() => {
        setBurstingPets(prev => {
          const next = new Set(prev);
          next.delete(petId);
          return next;
        });
        // Schedule next burst
        scheduleBurst(petId);
      }, 500);
      playBurstTimersRef.current.set(petId + "_clear", clearTimer);
    }, delay);
    playBurstTimersRef.current.set(petId, timer);
  }

  function stopPlayBursts() {
    for (const timer of playBurstTimersRef.current.values()) {
      clearTimeout(timer);
    }
    playBurstTimersRef.current.clear();
    setBurstingPets(new Set());
  }

  // Autonomous action controller lifecycle
  useEffect(() => {
    const controller = createAutonomousActionController({
      getPets: () => petsRef.current,
      getViewportWidth: () => window.innerWidth,
      getGroundY: () => getGroundY(),
      dispatchAutonomousRest: (petId, durationMs) => dispatchAutonomousRestFn(petId, durationMs),
      endAutonomousRest: (petId) => endAutonomousRestFn(petId),
      dispatchPlayTogether: (petId1, petId2, durationMs) => dispatchPlayTogetherFn(petId1, petId2, durationMs),
      endPlayTogether: (petId1, petId2) => endPlayTogetherFn(petId1, petId2),
      getCurrentHour: () => new Date().getHours(),
    });
    autonomousActionRef.current = controller;

    return () => {
      destroyAutonomousActionController(controller);
      autonomousActionRef.current = null;
    };
  }, []);

  // Helper: begins REST for a pet (sets state, starts timer, snaps to rest position)
  function beginRest(petId: string) {
    const pet = petsRef.current.find(p => p.id === petId);
    if (!pet) return;

    // Snap pet to its resolved rest Y position (ground level)
    const groundY = getGroundY();
    const restY = computeResolvedRestY(groundY, pet.resolvedProfile);

    // Start REST: set currentAction to "rest", visualState to "sleep", snap y to restY
    setPets(prev => prev.map(p =>
      p.id === petId
        ? { ...p, currentAction: "rest" as ActionName, visualState: "sleep" as VisualState, y: restY }
        : p
    ));

    // Start 30s timer
    const timer = setTimeout(async () => {
      // REST completed — apply stat benefit
      const currentPet = petsRef.current.find(p => p.id === petId);
      if (currentPet && currentPet.currentAction === "rest") {
        // Apply rest benefit using existing stat calculation
        const updatedPetData = applyRestAction(currentPet.pet);
        await window.petmiiAPI.savePet(updatedPetData);

        // Reset to idle
        setPets(prev => prev.map(p =>
          p.id === petId
            ? { ...p, currentAction: "idle" as ActionName, visualState: "idle" as VisualState, pet: updatedPetData, restTimer: null }
            : p
        ));

        // Notify main view
        window.petmiiAPI.sendRestEnded({ petId, completed: true });

        // Record rest care action (main process derives stage)
        window.petmiiAPI.careIncrement({ petId, action: "rest" });
      }
    }, REST_ACTION_DURATION_MS);

    // Store the timer in state
    setPets(prev => prev.map(p =>
      p.id === petId ? { ...p, restTimer: timer } : p
    ));
  }

  // REST action command handler
  useEffect(() => {
    const handleRestCommand = (data: { petId: string }) => {
      const { petId } = data;
      const pet = petsRef.current.find(p => p.id === petId);
      if (!pet) return; // Unknown pet — ignore
      if (pet.lifecycleState === "evolving") return; // Reject REST for evolving pets
      if (pet.currentAction === "rest") return; // Already resting — idempotent
      if (pendingRestRef.current.has(petId)) return; // Already queued — idempotent

      // If pet is in autonomousRest, cancel it and begin manual REST
      if (pet.currentAction === "autonomousRest") {
        cancelAutonomousRest(petId);
        beginRest(petId);
        return;
      }
      // If pet is in playTogether, cancel session and begin manual REST
      if (pet.currentAction === "playTogether") {
        cancelPlayTogether(petId);
        beginRest(petId);
        return;
      }

      // If the pet was in approachCursor, cancel immediately and start REST
      if (pet.currentAction === "approachCursor" && cursorAttractionRef.current) {
        const cancelMovement = movementCancelRef.current.get(petId);
        if (cancelMovement) {
          cancelMovement();
          movementCancelRef.current.delete(petId);
        }
        notifyApproachEnded(cursorAttractionRef.current, petId);
        beginRest(petId);
        return;
      }

      // If pet is mid-action (has an active movement animation), defer REST until it completes
      const hasActiveMovement = movementCancelRef.current.has(petId);
      if (hasActiveMovement && pet.currentAction !== "idle") {
        pendingRestRef.current.add(petId);
        return; // REST will be triggered in dispatchMovementAction's onComplete
      }

      // Pet is idle or no active animation — start REST immediately
      const cancelMovement = movementCancelRef.current.get(petId);
      if (cancelMovement) {
        cancelMovement();
        movementCancelRef.current.delete(petId);
      }
      beginRest(petId);
    };

    window.petmiiAPI.onRestCommand(handleRestCommand);
    return () => {
      // Cleanup: clear any active rest timers on unmount
      for (const pet of petsRef.current) {
        if (pet.restTimer) {
          clearTimeout(pet.restTimer);
        }
      }
    };
  }, []);

  function dispatchMovementAction(petId: string, action: ActionName) {
    const pet = petsRef.current.find(p => p.id === petId);
    if (!pet) return;

    const profile = pet.resolvedProfile;
    const maxX = getMaxX();
    const minX = 0;
    const groundY = getGroundY();
    const resolvedRestY = computeResolvedRestY(groundY, profile);

    let currentX = pet.x;
    let dir = pet.direction as 1 | -1;

    // Determine direction with wall detection
    const atLeftWall = currentX <= minX + WALL_PADDING;
    const atRightWall = currentX >= maxX - WALL_PADDING;

    if (atLeftWall) {
      dir = 1;
    } else if (atRightWall) {
      dir = -1;
    } else if (Math.random() < 0.15) {
      dir = -dir as 1 | -1;
    }

    let startX = currentX;
    let startY = pet.y;
    let targetX: number;
    let targetY: number;

    if (profile.movementStyle === "grounded") {
      // Grounded movement: hop/leap arc
      targetX = currentX + profile.stepDistance * dir;
      // If target would hit a wall, flip direction
      if (targetX <= minX || targetX >= maxX) {
        dir = targetX <= minX ? 1 : -1;
        targetX = currentX + profile.stepDistance * dir;
      }
      targetX = clamp(targetX, minX, maxX);
      startY = resolvedRestY;
      targetY = resolvedRestY;
    } else {
      // Floating movement: bob or drift
      if (action === "drift") {
        targetX = currentX + profile.stepDistance * dir;
        if (targetX <= minX || targetX >= maxX) {
          dir = targetX <= minX ? 1 : -1;
          targetX = currentX + profile.stepDistance * dir;
        }
        targetX = clamp(targetX, minX, maxX);
        startY = resolvedRestY;
        targetY = resolvedRestY;
      } else {
        // bob: vertical oscillation, no horizontal movement
        targetX = currentX;
        startY = resolvedRestY;
        targetY = resolvedRestY;
      }
    }

    // ─── Collision detection: check proposed target against eligible blockers ───
    const petRenderSize = getPetRenderSize();
    const blockers = getEligibleBlockers(
      petsRef.current.map(p => ({ id: p.id, physicsState: p.physicsState, x: p.x, y: p.y })),
      petId,
      "ground",
      petRenderSize,
    );
    const proposedBox = { x: targetX, y: targetY, width: petRenderSize, height: petRenderSize };
    const check = checkOverlap(proposedBox, blockers);

    if (check.collides) {
      const resolution = resolveCollision(currentX, targetX, profile.stepDistance, petRenderSize, blockers, 0, getMaxX());
      if (!resolution.resolved) {
        // No valid alternative — skip movement and set pet to idle for this cycle
        setPets(prev => prev.map(p => p.id === petId ? { ...p, currentAction: "idle" as ActionName } : p));
        return;
      }
      targetX = resolution.targetX;
      // Update direction to match the resolved target so the pet sprite faces correctly
      dir = targetX >= currentX ? 1 : -1;
    }

    // Set currentAction and direction before starting animation
    setPets(prev => prev.map(p =>
      p.id === petId ? { ...p, currentAction: action, direction: dir } : p
    ));

    // Cancel any existing movement animation for this pet
    const existingCancel = movementCancelRef.current.get(petId);
    if (existingCancel) {
      existingCancel();
    }

    // Start the movement animation
    const cancel = animateMovementAction(
      {
        startX,
        startY,
        targetX,
        targetY,
        duration: Math.max(profile.duration, 100),
        hopHeight: profile.hopHeight,
        landingPauseMs: profile.landingPauseMs,
        movementStyle: profile.movementStyle,
      },
      (x: number, y: number) => {
        // onFrame: update position
        setPets(prev => prev.map(p =>
          p.id === petId && p.currentAction === action
            ? { ...p, x, y }
            : p
        ));
      },
      () => {
        // onComplete: check if REST is pending, otherwise return to idle
        movementCancelRef.current.delete(petId);
        if (pendingRestRef.current.has(petId)) {
          pendingRestRef.current.delete(petId);
          beginRest(petId);
        } else {
          setPets(prev => prev.map(p =>
            p.id === petId
              ? { ...p, currentAction: "idle" as ActionName }
              : p
          ));
        }
      }
    );

    movementCancelRef.current.set(petId, cancel);
  }

  // Physics animation loop (for flying/gravity)
  useEffect(() => {
    function frame() {
      setPets((prev) => {
        let changed = false;
        const next = prev.map((p) => {
          if (p.physicsState !== "flying") return p;
          changed = true;

          let { x, y, vx, vy, rotation, angularVel } = p;
          vy += GRAVITY;
          x += vx;
          y += vy;
          rotation += angularVel;
          angularVel *= ANGULAR_DAMPING;

          // Wall bounce (side walls)
          let hitSideOrCeiling = false;
          if (x <= 0) {
            x = 0;
            vx = -vx * WALL_BOUNCE_DAMPING;
            angularVel *= -0.5;
            hitSideOrCeiling = true;
          }

          if (x >= getMaxX()) {
            x = getMaxX();
            vx = -vx * WALL_BOUNCE_DAMPING;
            angularVel *= -0.5;
            hitSideOrCeiling = true;
          }

          // Ceiling bounce
          if (y <= 0) {
            y = 0;
            vy = -vy * BOUNCE_DAMPING;
            hitSideOrCeiling = true;
          }

          // Track wall collision for care history (side/ceiling only, NOT ground)
          if (hitSideOrCeiling && throwSequenceRef.current && throwSequenceRef.current.petId === p.id && throwSequenceRef.current.active) {
            const { incrementHardThrow, updatedState } = onWallCollision(throwSequenceRef.current);
            throwSequenceRef.current = updatedState;
            if (incrementHardThrow) {
              window.petmiiAPI.careIncrement({ petId: p.id, action: "hardThrow" });
            }
          }

          // Head-bump detection: check if flying pet hits the top of an idle/gettingUp pet
          const flyingBox = { x, y, width: getPetRenderSize(), height: getPetRenderSize() };
          const headBumpBlockers = getEligibleBlockers(
            prev.map(pp => ({ id: pp.id, physicsState: pp.physicsState, x: pp.x, y: pp.y })),
            p.id,
            "headBump",
            getPetRenderSize(),
          );
          const bump = detectHeadBump(flyingBox, vx, vy, headBumpBlockers);
          if (bump.collided) {
            vx = bump.newVx;
            vy = bump.newVy;
          }

          // Ground (y >= 0 means at bottom of container - pet height - padding)
          const groundY = getGroundY();

          if (y >= groundY) {
            y = groundY;

            if (Math.abs(vy) < 2 && Math.abs(vx) < 1) {
              // Pet has landed — reset throw sequence
              if (throwSequenceRef.current && throwSequenceRef.current.petId === p.id) {
                throwSequenceRef.current = null;
              }
              return {
                ...p,
                x: clampX(x),
                y: groundY,
                vx: 0,
                vy: 0,
                rotation,
                angularVel: 0,
                physicsState: "landed" as PhysicsState,
              };
            }

            vy = -vy * BOUNCE_DAMPING;
            vx *= 0.85;
            angularVel *= 0.5;
          }

          return { ...p, x, y, vx, vy, rotation, angularVel };
        });

        return changed ? next : prev;
      });

      animFrameRef.current = requestAnimationFrame(frame);
    }

    animFrameRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [containerWidth]);

  // Handle landed pets getting back up
  useEffect(() => {
    const landedPets = pets.filter((p) => p.physicsState === "landed");
    for (const p of landedPets) {
      setTimeout(() => {
        setPets((prev) =>
          prev.map((pp) =>
            pp.id === p.id && pp.physicsState === "landed"
              ? { ...pp, physicsState: "gettingUp" as PhysicsState }
              : pp,
          ),
        );
        setTimeout(() => {
          setPets((prev) =>
            prev.map((pp) => {
              if (pp.id === p.id && pp.physicsState === "gettingUp") {
                const restY = computeResolvedRestY(getGroundY(), pp.resolvedProfile);
                return { ...pp, physicsState: "idle" as PhysicsState, rotation: 0, y: restY };
              }
              return pp;
            }),
          );
        }, 800);
      }, 1200);
    }
  }, [pets.filter((p) => p.physicsState === "landed").length]);

  // ===== Drag handling =====

  // "!" stays until user dismisses by clicking it (exits to main to see eggs)
  const handleMouseDown = useCallback(
    (petId: string, e: React.MouseEvent) => {
      e.preventDefault();
      // Suppress drag during evolution
      const petState = petsRef.current.find(p => p.id === petId);
      if (petState?.lifecycleState === "evolving") return;
      // If pet has egg notification, dismiss it
      const pet = pets.find((p) => p.id === petId);
      if (pet?.hasFoundEgg) {
        setPets((prev) =>
          prev.map((p) => (p.id === petId ? { ...p, hasFoundEgg: false } : p)),
        );
      }
      // Cancel any in-progress movement animation for this pet
      const cancelMovement = movementCancelRef.current.get(petId);
      if (cancelMovement) {
        cancelMovement();
        movementCancelRef.current.delete(petId);
      }
      // Clear any pending REST (user dragging takes priority)
      pendingRestRef.current.delete(petId);
      // If the pet was in approachCursor, notify controller to release slot and record cooldown
      if (petState?.currentAction === "approachCursor" && cursorAttractionRef.current) {
        notifyApproachEnded(cursorAttractionRef.current, petId);
      }
      // If the pet is resting, cancel the REST action
      if (petState?.currentAction === "rest" && petState?.restTimer) {
        clearTimeout(petState.restTimer);
        // Notify main view that REST was interrupted — no stat benefit
        window.petmiiAPI.sendRestEnded({ petId, completed: false });
      }
      // Cancel autonomousRest if active
      if (petState?.currentAction === "autonomousRest") {
        cancelAutonomousRest(petId);
      }
      // Cancel playTogether if active (ends session for BOTH pets)
      if (petState?.currentAction === "playTogether") {
        cancelPlayTogether(petId);
      }
      // Start drag immediately — no click/drag threshold
      dragState.current = {
        petId,
        startTime: Date.now(),
        started: true,
        history: [{ x: e.clientX, y: e.clientY, t: Date.now() }],
      };

      // Track pickedUp care action (client-side cooldown pre-check is optimization only)
      const lastCountedAt = petState?.pet.careHistory?.metadata?.pickedUpLastCountedAt ?? null;
      if (shouldCountPickup(lastCountedAt, Date.now())) {
        window.petmiiAPI.careIncrement({ petId, action: "pickedUp" });
      }

      // Position pet centered on cursor immediately
      const rect = containerRef.current?.getBoundingClientRect();
      const renderSize = getPetRenderSize();
      const newX = rect ? clampX(e.clientX - rect.left - renderSize / 2) : pet?.x ?? 0;
      const newY = rect ? clampY(e.clientY - rect.top - renderSize / 2) : pet?.y ?? 0;

      setPets((prev) =>
        prev.map((p) =>
          p.id === petId ? { ...p, x: newX, y: newY, physicsState: "dragging" as PhysicsState, currentAction: "idle" as ActionName, visualState: "idle" as VisualState, restTimer: null } : p,
        ),
      );
    },
    [pets],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const ds = dragState.current;
    if (!ds.petId || !ds.started) return;

    // Move pet to cursor
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const renderSize = getPetRenderSize();
      const x = e.clientX - rect.left - renderSize / 2;
      const y = e.clientY - rect.top - renderSize / 2;

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
  }, []);

  const handleMouseUp = useCallback(() => {
    const ds = dragState.current;
    if (!ds.petId) return;
    const releasedPetId = ds.petId;

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

      // Classify release for care history tracking
      const releaseSpeed = Math.sqrt(vx * vx + vy * vy);
      const { actions } = classifyRelease(releaseSpeed);
      for (const action of actions) {
        window.petmiiAPI.careIncrement({ petId: releasedPetId, action });
      }

      const isThrown = Math.abs(vx) > 2 || Math.abs(vy) > 2;
      // Cap velocity to prevent extreme throws
      vx = Math.max(-15, Math.min(15, vx));
      vy = Math.max(-15, Math.min(15, vy));

      if (!isThrown) {
        const pet = petsRef.current.find(p => p.id === ds.petId);
        if (pet) {
          const restY = computeResolvedRestY(getGroundY(), pet.resolvedProfile);
          const heightAboveRest = restY - pet.y;

          if (heightAboveRest > AIR_RELEASE_THRESHOLD_PX) {
            // Air release — enter flying with zero velocity, gravity does the rest
            setPets((prev) =>
              prev.map((p) =>
                p.id === ds.petId
                  ? { ...p, physicsState: "flying" as PhysicsState, x: clampX(p.x), vx: 0, vy: 0, angularVel: 0 }
                  : p,
              ),
            );
          } else {
            // Ground-level release — snap to rest (existing behavior)
            setPets((prev) =>
              prev.map((p) =>
                p.id === ds.petId
                  ? { ...p, physicsState: "idle" as PhysicsState, x: clampX(p.x), y: restY, vx: 0, vy: 0, angularVel: 0, rotation: 0 }
                  : p,
              ),
            );
          }
        }
        throwSequenceRef.current = null;
      } else {
        // High velocity — enter throw flight
        const angularVel = vx * ANGULAR_VEL_FACTOR;
        setPets((prev) =>
          prev.map((p) =>
            p.id === ds.petId
              ? {
                  ...p,
                  x: clampX(p.x),
                  y: clampY(p.y),
                  physicsState: "flying" as PhysicsState,
                  vx,
                  vy,
                  angularVel,
                }
              : p,
          ),
        );

        // Start throw sequence tracking if speed meets threshold
        if (releaseSpeed >= THROW_SPEED_THRESHOLD) {
          const seqState = createThrowSequenceState(releasedPetId);
          throwSequenceRef.current = {
            ...seqState,
            hardThrowCounted: actions.includes("hardThrow"),
          };
        } else {
          throwSequenceRef.current = null;
        }
      }
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
      {pets.map((p) => {
        const evolutionStyles = evolutionAnimRef.current?.petId === p.id
          ? computeEvolutionStyles(Date.now() - evolutionAnimRef.current.startedAt)
          : null;

        return (
        <div
          key={p.id}
          className={`overlay-pet ${p.physicsState === "dragging" ? "dragging" : ""} ${p.physicsState === "flying" ? "physics-flying" : ""} ${p.physicsState === "landed" ? "physics-landed" : ""} ${p.physicsState === "gettingUp" ? "physics-getting-up" : ""} ${p.isLeaving ? "leaving" : ""}`}
          style={{
            position: "absolute",
            width: `${getPetRenderSize()}px`,
            height: `${getPetRenderSize()}px`,
            left: `${p.x}px`,
            top: `${p.y}px`,
            transform: [
              p.rotation ? `rotate(${p.rotation}deg)` : "",
              evolutionStyles ? `scale(${parseScaleFromTransform(evolutionStyles.transform)})` : "",
            ].filter(Boolean).join(" ") || undefined,
            transition: p.physicsState === "gettingUp"
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
          {/* Namecard */}
          <PetNamecard
            pet={p.pet}
            isHovered={p.isHovered}
            physicsState={p.physicsState}
          />

          {/* Egg found notification */}
          {p.physicsState !== "flying" && p.physicsState !== "landed" && p.hasFoundEgg && (
            <div className="overlay-egg-found">!</div>
          )}

          {/* Low stat alerts */}
          {
            <LowStatAlerts
              pet={p.pet}
              physicsState={p.physicsState}
              lifecycleState={p.lifecycleState}
            />
          }

          {/* Pet sprite */}
          <div
            className={`overlay-pet-body${burstingPets.has(p.id) ? " play-together-burst" : ""}`}
            style={{
              width: `${PET_BASE_SIZE}px`,
              height: `${PET_BASE_SIZE}px`,
              marginLeft: `-${PET_BASE_SIZE / 2}px`,
              transform: `scale(${petScale})${p.direction === -1 && p.physicsState !== "flying" ? " scaleX(-1)" : ""}`,
              filter: evolutionStyles ? evolutionStyles.filter : undefined,
              opacity: evolutionStyles ? evolutionStyles.opacity : undefined,
            }}
          >
            <PetAvatar
              species={p.pet.species}
              variantId={resolveVariantId(p.pet)}
              personality={p.pet.personality}
              lifeStage={p.pet.lifeStage}
              visualState={p.visualState}
            />
          </div>

          {/* Speech bubble */}
          {p.message && p.physicsState !== "flying" && p.physicsState !== "landed" && p.lifecycleState !== "evolving" && (
            <div className="overlay-speech">
              <span>{p.message}</span>
            </div>
          )}

          {/* playTogether sparkle indicator — positioned on the inner side (between pets) */}
          {p.currentAction === "playTogether" && p.physicsState !== "flying" && playTogetherIcon && (
            <div className={`overlay-play-together-indicator ${p.direction === 1 ? "indicator-right" : "indicator-left"}`}>{playTogetherIcon}</div>
          )}
        </div>
        );
      })}
    </div>
  );
}

function LowStatAlerts({
  pet,
  physicsState,
  lifecycleState,
}: {
  pet: PetState;
  physicsState: PhysicsState;
  lifecycleState: LifecycleState;
}) {
  if (physicsState === "flying" || physicsState === "landed") {
    return;
  }
  if (lifecycleState === "evolving") {
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

function applyRestAction(pet: PetState): PetState {
  const now = new Date().toISOString();
  const AMOUNT = 25;
  const BOND = 2;
  return {
    ...pet,
    energy: clamp(pet.energy + AMOUNT, 0, 100),
    hunger: clamp(pet.hunger - 5, 0, 100),
    bond: clamp(pet.bond + BOND, 0, 100),
    lastRestedAt: now,
    updatedAt: now,
  };
}

/** Autonomous rest gives 50% of user-initiated rest benefits */
function applyAutonomousRestAction(pet: PetState): PetState {
  const now = new Date().toISOString();
  const AMOUNT = 12; // 50% of 25
  const HUNGER_REDUCTION = 2; // 50% of 5, rounded down
  const BOND = 1; // 50% of 2
  return {
    ...pet,
    energy: clamp(pet.energy + AMOUNT, 0, 100),
    hunger: clamp(pet.hunger - HUNGER_REDUCTION, 0, 100),
    bond: clamp(pet.bond + BOND, 0, 100),
    lastRestedAt: now,
    updatedAt: now,
  };
}

/** Autonomous playTogether gives 50% of user-initiated play benefits to each pet */
function applyAutonomousPlayAction(pet: PetState): PetState {
  const now = new Date().toISOString();
  const HAPPINESS = 10; // 50% of 20
  const ENERGY_COST = 5; // 50% of 10
  const HUNGER_COST = 2; // 50% of 5, rounded down
  const BOND = 1; // 50% of 2
  return {
    ...pet,
    happiness: clamp(pet.happiness + HAPPINESS, 0, 100),
    energy: clamp(pet.energy - ENERGY_COST, 0, 100),
    hunger: clamp(pet.hunger - HUNGER_COST, 0, 100),
    bond: clamp(pet.bond + BOND, 0, 100),
    lastPlayedAt: now,
    updatedAt: now,
  };
}

function createPetState(pet: PetState, screenWidth: number, scale = DEFAULT_PET_SCALE): PetOverlayState {
  const renderSize = PET_BASE_SIZE * scale;
  const groundY = window.innerHeight - renderSize - GROUND_OFFSET_PX;
  const profile = resolveProfile(pet.species, pet.lifeStage, MOVEMENT_PROFILES);
  const restY = computeResolvedRestY(groundY, profile);

  return {
    id: pet.id,
    pet,
    x: Math.random() * Math.max(0, screenWidth - renderSize),
    y: restY,
    vx: 0,
    vy: 0,
    rotation: 0,
    angularVel: 0,
    direction: Math.random() > 0.5 ? 1 : -1,
    currentAction: "idle",
    physicsState: "idle",
    visualState: "idle",
    lifecycleState: "normal",
    resolvedProfile: profile,
    restTimer: null,
    message: null,
    messageTimer: null,
    hasFoundEgg: false,
    isHovered: false,
    isLeaving: false,
  };
}
