import { BrowserWindow, screen } from "electron";
import path from "path";
import { loadPetState } from "./petStorage";

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let overlayVisible = false;
let overlayTickInterval: ReturnType<typeof setInterval> | null = null;
let physicsInterval: ReturnType<typeof setInterval> | null = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// Drag position history for velocity calculation
const DRAG_HISTORY_SIZE = 5;
const dragHistory: { x: number; y: number; t: number }[] = [];

// Pet overlay dimensions
const PET_WIDTH = 150;
const PET_HEIGHT = 80;

// Walking behavior config
const WALK_STEP_PX = 70;
const OVERLAY_TICK_MS = 3500;
const WALK_PAUSE_CHANCE = 0.4;
const HOP_DURATION_MS = 650;
const HOP_HEIGHT_PX = 30;
const FRAME_MS = 16; // ~60fps

// Physics config
const GRAVITY = 1.2; // pixels/frame² downward acceleration
const WALL_BOUNCE_DAMPING = 0.6; // horizontal velocity retained on wall hit
const GROUND_BOUNCE_DAMPING = 0.3; // vertical velocity retained on ground hit
const GROUND_FRICTION = 0.85; // horizontal slowdown on ground bounce
const ANGULAR_VEL_FACTOR = 0.08; // how much throw speed translates to spin
const ANGULAR_DAMPING = 0.92; // spin slowdown per frame
const STAND_UP_DELAY_MS = 1200; // wait before standing up after landing

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    title: "petmii",
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.webContents.on("did-finish-load", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
      mainWindow.webContents.focus();
    }
  });

  mainWindow.on("focus", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.focus();
    }
  });

  mainWindow.on("minimize", () => {
    const pet = loadPetState();
    if (pet && !overlayVisible) {
      showOverlay();
    }
  });

  mainWindow.on("restore", () => {
    hideOverlay();
  });

  return mainWindow;
}

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const posX = Math.round(Math.random() * (screenWidth - PET_WIDTH));
  const posY = screenHeight - PET_HEIGHT;

  overlayWindow = new BrowserWindow({
    width: PET_WIDTH,
    height: PET_HEIGHT,
    x: posX,
    y: posY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: true,
    minimizable: false,
    maximizable: false,
    closable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true);
  overlayWindow.setIgnoreMouseEvents(false);

  overlayWindow.on("blur", () => {
    if (overlayWindow && !overlayWindow.isDestroyed() && overlayVisible) {
      overlayWindow.setAlwaysOnTop(true, "screen-saver");
    }
  });

  const overlayURL = process.env.ELECTRON_RENDERER_URL
    ? `${process.env.ELECTRON_RENDERER_URL}/src/renderer/overlay.html`
    : path.join(__dirname, "../renderer/overlay.html");

  if (process.env.ELECTRON_RENDERER_URL) {
    overlayWindow.loadURL(overlayURL);
  } else {
    overlayWindow.loadFile(path.join(__dirname, "../renderer/overlay.html"));
  }

  return overlayWindow;
}

// ===== Hop animation =====

function animateHop(targetX: number, baseY: number): Promise<void> {
  return new Promise((resolve) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      resolve();
      return;
    }

    const startX = overlayWindow.getBounds().x;
    const startTime = Date.now();

    const hopTimer = setInterval(() => {
      if (!overlayWindow || overlayWindow.isDestroyed()) {
        clearInterval(hopTimer);
        resolve();
        return;
      }

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / HOP_DURATION_MS, 1);

      const easedProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const arcHeight = Math.sin(progress * Math.PI) * HOP_HEIGHT_PX;

      const currentX = Math.round(startX + (targetX - startX) * easedProgress);
      const currentY = Math.round(baseY - arcHeight);

      overlayWindow.setPosition(currentX, currentY);

      if (progress >= 1) {
        clearInterval(hopTimer);
        overlayWindow.setPosition(Math.round(targetX), Math.round(baseY));
        resolve();
      }
    }, FRAME_MS);
  });
}

// ===== Single merged overlay tick =====

let isHopping = false;
let walkDirection = Math.random() > 0.5 ? 1 : -1;

function startOverlayTick(): void {
  stopOverlayTick();

  overlayTickInterval = setInterval(async () => {
    if (!overlayWindow || overlayWindow.isDestroyed() || !overlayVisible) {
      stopOverlayTick();
      return;
    }

    overlayWindow.setAlwaysOnTop(true, "screen-saver");
    if (!overlayWindow.isVisible()) {
      overlayWindow.show();
    }

    if (isHopping || isDragging) return;
    if (Math.random() < WALK_PAUSE_CHANCE) return;

    if (Math.random() < 0.15) {
      walkDirection *= -1;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const bounds = overlayWindow.getBounds();
    const baseY = screenHeight - PET_HEIGHT;

    let targetX = bounds.x + (WALK_STEP_PX * walkDirection);

    if (targetX <= 0) {
      targetX = 0;
      walkDirection = 1;
    } else if (targetX >= screenWidth - PET_WIDTH) {
      targetX = screenWidth - PET_WIDTH;
      walkDirection = -1;
    }

    if (overlayWindow.webContents && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send("pet:direction", walkDirection > 0 ? "right" : "left");
    }

    isHopping = true;
    await animateHop(targetX, baseY);
    isHopping = false;

  }, OVERLAY_TICK_MS);
}

function stopOverlayTick(): void {
  if (overlayTickInterval !== null) {
    clearInterval(overlayTickInterval);
    overlayTickInterval = null;
  }
}

// ===== Show / Hide / Close =====

export function showOverlay(): void {
  overlayVisible = true;
  const overlay = createOverlayWindow();

  overlay.show();
  overlay.setAlwaysOnTop(true, "screen-saver");

  // Reset rotation when showing
  sendRotation(0);
  sendState("idle");

  startOverlayTick();

  const pet = loadPetState();
  if (pet && overlay.webContents) {
    const sendData = () => {
      if (overlay.isDestroyed()) return;
      overlay.webContents.send("pet:variant-update", {
        species: pet.species,
        color: pet.color,
        personality: pet.personality,
      });
      overlay.webContents.send("pet:state-update", pet);
    };

    if (overlay.webContents.isLoading()) {
      overlay.webContents.once("did-finish-load", sendData);
    } else {
      sendData();
    }
  }
}

export function hideOverlay(): void {
  overlayVisible = false;
  stopOverlayTick();
  stopPhysics();
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
}

export function closeOverlayWindow(): void {
  overlayVisible = false;
  stopOverlayTick();
  stopPhysics();
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
}

export function restoreMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.restore();
    mainWindow.focus();
  }
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow;
}

export function isOverlayVisible(): boolean {
  return overlayVisible;
}

// ===== Renderer communication helpers =====

function sendRotation(degrees: number): void {
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.webContents) {
    overlayWindow.webContents.send("pet:rotation", degrees);
  }
}

function sendState(state: "idle" | "flying" | "landed" | "getting-up"): void {
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.webContents) {
    overlayWindow.webContents.send("pet:physics-state", state);
  }
}

// ===== Drag & Throw Physics =====

export function startDrag(screenX: number, screenY: number): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;

  const bounds = overlayWindow.getBounds();
  dragOffset = {
    x: screenX - bounds.x,
    y: screenY - bounds.y,
  };
  isDragging = true;
  dragHistory.length = 0;
  dragHistory.push({ x: screenX, y: screenY, t: Date.now() });

  stopOverlayTick();
  stopPhysics();
  sendRotation(0);
  sendState("idle");
}

export function moveDrag(screenX: number, screenY: number): void {
  if (!isDragging || !overlayWindow || overlayWindow.isDestroyed()) return;

  const newX = screenX - dragOffset.x;
  const newY = screenY - dragOffset.y;
  overlayWindow.setPosition(Math.round(newX), Math.round(newY));

  // Record position for velocity calculation
  dragHistory.push({ x: screenX, y: screenY, t: Date.now() });
  if (dragHistory.length > DRAG_HISTORY_SIZE) {
    dragHistory.shift();
  }
}

export function endDrag(): void {
  isDragging = false;
  if (!overlayWindow || overlayWindow.isDestroyed()) return;

  // Calculate throw velocity from recent drag positions
  const throwVelocity = calculateThrowVelocity();
  simulateThrow(throwVelocity.vx, throwVelocity.vy);
}

/**
 * Calculates throw velocity from the last few drag positions.
 * Returns velocity in pixels per frame (at 60fps).
 */
function calculateThrowVelocity(): { vx: number; vy: number } {
  if (dragHistory.length < 2) {
    return { vx: 0, vy: 0 };
  }

  const recent = dragHistory[dragHistory.length - 1];
  const older = dragHistory[0];
  const dt = recent.t - older.t;

  if (dt === 0) return { vx: 0, vy: 0 };

  // Pixels per millisecond → pixels per frame (16ms)
  const pxPerMs = {
    x: (recent.x - older.x) / dt,
    y: (recent.y - older.y) / dt,
  };

  return {
    vx: pxPerMs.x * FRAME_MS,
    vy: pxPerMs.y * FRAME_MS,
  };
}

/**
 * Full physics simulation: projectile motion with rotation,
 * wall bouncing, and ground landing with recovery.
 */
function simulateThrow(vx: number, vy: number): void {
  stopPhysics();

  if (!overlayWindow || overlayWindow.isDestroyed()) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const groundY = screenHeight - PET_HEIGHT;

  let velX = vx;
  let velY = vy;
  let rotation = 0;
  // Angular velocity based on throw speed (faster throw = more spin)
  let angularVel = vx * ANGULAR_VEL_FACTOR;

  const isThrown = Math.abs(vx) > 2 || Math.abs(vy) > 2;

  if (isThrown) {
    sendState("flying");
  }

  physicsInterval = setInterval(() => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      stopPhysics();
      return;
    }

    const bounds = overlayWindow.getBounds();

    // Apply gravity
    velY += GRAVITY;

    // Update position
    let newX = bounds.x + velX;
    let newY = bounds.y + velY;

    // Update rotation while in air
    if (isThrown) {
      rotation += angularVel;
      angularVel *= ANGULAR_DAMPING;
      sendRotation(rotation);
    }

    // Wall collision (left/right)
    if (newX <= 0) {
      newX = 0;
      velX = -velX * WALL_BOUNCE_DAMPING;
      angularVel = -angularVel * 0.5;
    } else if (newX >= screenWidth - PET_WIDTH) {
      newX = screenWidth - PET_WIDTH;
      velX = -velX * WALL_BOUNCE_DAMPING;
      angularVel = -angularVel * 0.5;
    }

    // Ceiling collision (top)
    if (newY <= 0) {
      newY = 0;
      velY = -velY * GROUND_BOUNCE_DAMPING;
      angularVel *= 0.5;
    }

    // Ground collision
    if (newY >= groundY) {
      newY = groundY;

      // Check if settled
      if (Math.abs(velY) < 2 && Math.abs(velX) < 1) {
        // Landed and settled
        stopPhysics();
        overlayWindow.setPosition(Math.round(newX), groundY);

        if (isThrown) {
          // Snap rotation to nearest "fallen" angle and trigger recovery
          const snappedRotation = snapRotation(rotation);
          sendRotation(snappedRotation);
          sendState("landed");

          // After a delay, stand back up
          setTimeout(() => {
            if (!overlayWindow || overlayWindow.isDestroyed() || !overlayVisible) return;
            sendState("getting-up");
            sendRotation(0);

            // After stand-up animation, resume walking
            setTimeout(() => {
              if (!overlayWindow || overlayWindow.isDestroyed() || !overlayVisible) return;
              sendState("idle");
              startOverlayTick();
            }, 800);
          }, STAND_UP_DELAY_MS);
        } else {
          // Gentle drop — just resume walking
          sendState("idle");
          startOverlayTick();
        }
        return;
      }

      // Bounce off ground
      velY = -velY * GROUND_BOUNCE_DAMPING;
      velX *= GROUND_FRICTION;
      angularVel *= 0.5;
    }

    overlayWindow.setPosition(Math.round(newX), Math.round(newY));
  }, FRAME_MS);
}

/**
 * Snaps rotation to the nearest 90° increment for a natural "fallen" look.
 * 0° = upright, 90° = on right side, 180° = upside down, 270° = on left side
 */
function snapRotation(degrees: number): number {
  // Normalize to 0-360
  const normalized = ((degrees % 360) + 360) % 360;
  // Snap to nearest 90
  const snapped = Math.round(normalized / 90) * 90;
  return snapped === 360 ? 0 : snapped;
}

function stopPhysics(): void {
  if (physicsInterval !== null) {
    clearInterval(physicsInterval);
    physicsInterval = null;
  }
}
