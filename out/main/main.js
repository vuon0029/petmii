"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const PET_STATE_FILENAME = "pet-state.json";
function getStoragePath() {
  return path.join(electron.app.getPath("userData"), PET_STATE_FILENAME);
}
const VALID_SPECIES = ["mochi", "blob", "bun", "sprout", "ghost", "star"];
const VALID_COLORS = ["cream", "pink", "blue", "mint", "lavender", "yellow"];
const VALID_PERSONALITIES = ["sweet", "chaotic", "sleepy", "curious", "shy", "sassy"];
const VALID_MOODS = ["happy", "sad", "hungry", "sleepy", "playful", "neutral", "sick", "dead"];
const VALID_LIFE_STAGES = ["egg", "baby", "child", "adult"];
function isStatValue(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}
function validatePetState(data) {
  if (data === null || data === void 0 || typeof data !== "object") {
    return false;
  }
  const obj = data;
  if (typeof obj.id !== "string" || obj.id.length === 0) return false;
  if (typeof obj.name !== "string" || obj.name.length === 0) return false;
  if (typeof obj.hatchedAt !== "string" || obj.hatchedAt.length === 0) return false;
  if (typeof obj.createdAt !== "string" || obj.createdAt.length === 0) return false;
  if (typeof obj.updatedAt !== "string" || obj.updatedAt.length === 0) return false;
  if (!VALID_SPECIES.includes(obj.species)) return false;
  if (!VALID_COLORS.includes(obj.color)) return false;
  if (!VALID_PERSONALITIES.includes(obj.personality)) return false;
  if (!VALID_MOODS.includes(obj.mood)) return false;
  if (!VALID_LIFE_STAGES.includes(obj.lifeStage)) return false;
  if (typeof obj.isAlive !== "boolean") return false;
  if (typeof obj.isShiny !== "boolean") return false;
  if (!isStatValue(obj.hunger)) return false;
  if (!isStatValue(obj.happiness)) return false;
  if (!isStatValue(obj.energy)) return false;
  if (!isStatValue(obj.cleanliness)) return false;
  if (!isStatValue(obj.bond)) return false;
  if (!isStatValue(obj.hp)) return false;
  return true;
}
function loadPetState() {
  const storagePath = getStoragePath();
  try {
    if (!fs.existsSync(storagePath)) {
      return null;
    }
    const raw = fs.readFileSync(storagePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!validatePetState(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function savePetState(state) {
  const storagePath = getStoragePath();
  const tempPath = storagePath + ".tmp";
  try {
    const dir = path.dirname(storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const json = JSON.stringify(state, null, 2);
    fs.writeFileSync(tempPath, json, "utf-8");
    fs.renameSync(tempPath, storagePath);
    return true;
  } catch {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
    }
    return false;
  }
}
function clearPetState() {
  const storagePath = getStoragePath();
  try {
    if (!fs.existsSync(storagePath)) {
      return true;
    }
    fs.unlinkSync(storagePath);
    return true;
  } catch {
    return false;
  }
}
const GRAVEYARD_FILENAME = "graveyard.json";
function getGraveyardPath() {
  return path.join(electron.app.getPath("userData"), GRAVEYARD_FILENAME);
}
function loadGraveyard() {
  const filepath = getGraveyardPath();
  try {
    if (!fs.existsSync(filepath)) return [];
    const raw = fs.readFileSync(filepath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}
function saveGraveyard(entries) {
  const filepath = getGraveyardPath();
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, JSON.stringify(entries, null, 2), "utf-8");
}
function saveToGraveyard(pet) {
  const entries = loadGraveyard();
  const entry = {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    color: pet.color,
    personality: pet.personality,
    isShiny: pet.isShiny,
    hatchedAt: pet.hatchedAt,
    diedAt: pet.diedAt || (/* @__PURE__ */ new Date()).toISOString()
  };
  entries.push(entry);
  saveGraveyard(entries);
}
function removeFromGraveyard(id) {
  const entries = loadGraveyard();
  const filtered = entries.filter((e) => e.id !== id);
  saveGraveyard(filtered);
}
const APP_ICON = path.join(__dirname, "../../build/icon.ico");
let mainWindow = null;
let overlayWindow = null;
let overlayVisible = false;
let overlayTickInterval = null;
let physicsInterval = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
const DRAG_HISTORY_SIZE = 5;
const dragHistory = [];
const PET_WIDTH = 150;
const PET_HEIGHT = 80;
const WALK_STEP_PX = 70;
const OVERLAY_TICK_MS = 3500;
const WALK_PAUSE_CHANCE = 0.4;
const HOP_DURATION_MS = 650;
const HOP_HEIGHT_PX = 30;
const FRAME_MS = 16;
const GRAVITY = 1.2;
const WALL_BOUNCE_DAMPING = 0.6;
const GROUND_BOUNCE_DAMPING = 0.3;
const GROUND_FRICTION = 0.85;
const ANGULAR_VEL_FACTOR = 0.08;
const ANGULAR_DAMPING = 0.92;
const STAND_UP_DELAY_MS = 1200;
function createMainWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 400,
    height: 600,
    title: "petmii",
    icon: APP_ICON,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
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
function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }
  const primaryDisplay = electron.screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const posX = Math.round(Math.random() * (screenWidth - PET_WIDTH));
  const posY = screenHeight - PET_HEIGHT;
  overlayWindow = new electron.BrowserWindow({
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
      contextIsolation: true
    }
  });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true);
  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.on("blur", () => {
    if (overlayWindow && !overlayWindow.isDestroyed() && overlayVisible) {
      overlayWindow.setAlwaysOnTop(true, "screen-saver");
    }
  });
  const overlayURL = process.env.ELECTRON_RENDERER_URL ? `${process.env.ELECTRON_RENDERER_URL}/src/renderer/overlay.html` : path.join(__dirname, "../renderer/overlay.html");
  if (process.env.ELECTRON_RENDERER_URL) {
    overlayWindow.loadURL(overlayURL);
  } else {
    overlayWindow.loadFile(path.join(__dirname, "../renderer/overlay.html"));
  }
  return overlayWindow;
}
function animateHop(targetX, baseY) {
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
      const easedProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
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
let isHopping = false;
let walkDirection = Math.random() > 0.5 ? 1 : -1;
function startOverlayTick() {
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
    const primaryDisplay = electron.screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const bounds = overlayWindow.getBounds();
    const baseY = screenHeight - PET_HEIGHT;
    let targetX = bounds.x + WALK_STEP_PX * walkDirection;
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
function stopOverlayTick() {
  if (overlayTickInterval !== null) {
    clearInterval(overlayTickInterval);
    overlayTickInterval = null;
  }
}
function showOverlay() {
  overlayVisible = true;
  const overlay = createOverlayWindow();
  overlay.show();
  overlay.setAlwaysOnTop(true, "screen-saver");
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
        personality: pet.personality
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
function hideOverlay() {
  overlayVisible = false;
  stopOverlayTick();
  stopPhysics();
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
}
function closeOverlayWindow() {
  overlayVisible = false;
  stopOverlayTick();
  stopPhysics();
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
}
function restoreMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.restore();
    mainWindow.focus();
  }
}
function getMainWindow() {
  return mainWindow;
}
function getOverlayWindow() {
  return overlayWindow;
}
function sendRotation(degrees) {
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.webContents) {
    overlayWindow.webContents.send("pet:rotation", degrees);
  }
}
function sendState(state) {
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.webContents) {
    overlayWindow.webContents.send("pet:physics-state", state);
  }
}
function startDrag(screenX, screenY) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const bounds = overlayWindow.getBounds();
  dragOffset = {
    x: screenX - bounds.x,
    y: screenY - bounds.y
  };
  isDragging = true;
  dragHistory.length = 0;
  dragHistory.push({ x: screenX, y: screenY, t: Date.now() });
  stopOverlayTick();
  stopPhysics();
  sendRotation(0);
  sendState("idle");
}
function moveDrag(screenX, screenY) {
  if (!isDragging || !overlayWindow || overlayWindow.isDestroyed()) return;
  const newX = screenX - dragOffset.x;
  const newY = screenY - dragOffset.y;
  overlayWindow.setPosition(Math.round(newX), Math.round(newY));
  dragHistory.push({ x: screenX, y: screenY, t: Date.now() });
  if (dragHistory.length > DRAG_HISTORY_SIZE) {
    dragHistory.shift();
  }
}
function endDrag() {
  isDragging = false;
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const throwVelocity = calculateThrowVelocity();
  simulateThrow(throwVelocity.vx, throwVelocity.vy);
}
function calculateThrowVelocity() {
  if (dragHistory.length < 2) {
    return { vx: 0, vy: 0 };
  }
  const recent = dragHistory[dragHistory.length - 1];
  const older = dragHistory[0];
  const dt = recent.t - older.t;
  if (dt === 0) return { vx: 0, vy: 0 };
  const pxPerMs = {
    x: (recent.x - older.x) / dt,
    y: (recent.y - older.y) / dt
  };
  return {
    vx: pxPerMs.x * FRAME_MS,
    vy: pxPerMs.y * FRAME_MS
  };
}
function simulateThrow(vx, vy) {
  stopPhysics();
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const primaryDisplay = electron.screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const groundY = screenHeight - PET_HEIGHT;
  let velX = vx;
  let velY = vy;
  let rotation = 0;
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
    velY += GRAVITY;
    let newX = bounds.x + velX;
    let newY = bounds.y + velY;
    if (isThrown) {
      rotation += angularVel;
      angularVel *= ANGULAR_DAMPING;
      sendRotation(rotation);
    }
    if (newX <= 0) {
      newX = 0;
      velX = -velX * WALL_BOUNCE_DAMPING;
      angularVel = -angularVel * 0.5;
    } else if (newX >= screenWidth - PET_WIDTH) {
      newX = screenWidth - PET_WIDTH;
      velX = -velX * WALL_BOUNCE_DAMPING;
      angularVel = -angularVel * 0.5;
    }
    if (newY <= 0) {
      newY = 0;
      velY = -velY * GROUND_BOUNCE_DAMPING;
      angularVel *= 0.5;
    }
    if (newY >= groundY) {
      newY = groundY;
      if (Math.abs(velY) < 2 && Math.abs(velX) < 1) {
        stopPhysics();
        overlayWindow.setPosition(Math.round(newX), groundY);
        if (isThrown) {
          const snappedRotation = snapRotation(rotation);
          sendRotation(snappedRotation);
          sendState("landed");
          setTimeout(() => {
            if (!overlayWindow || overlayWindow.isDestroyed() || !overlayVisible) return;
            sendState("getting-up");
            sendRotation(0);
            setTimeout(() => {
              if (!overlayWindow || overlayWindow.isDestroyed() || !overlayVisible) return;
              sendState("idle");
              startOverlayTick();
            }, 800);
          }, STAND_UP_DELAY_MS);
        } else {
          sendState("idle");
          startOverlayTick();
        }
        return;
      }
      velY = -velY * GROUND_BOUNCE_DAMPING;
      velX *= GROUND_FRICTION;
      angularVel *= 0.5;
    }
    overlayWindow.setPosition(Math.round(newX), Math.round(newY));
  }, FRAME_MS);
}
function snapRotation(degrees) {
  const normalized = (degrees % 360 + 360) % 360;
  const snapped = Math.round(normalized / 90) * 90;
  return snapped === 360 ? 0 : snapped;
}
function stopPhysics() {
  if (physicsInterval !== null) {
    clearInterval(physicsInterval);
    physicsInterval = null;
  }
}
function registerIpcHandlers() {
  electron.ipcMain.handle("pet:load", () => loadPetState());
  electron.ipcMain.handle("pet:save", (_, state) => savePetState(state));
  electron.ipcMain.handle("pet:clear", () => clearPetState());
  electron.ipcMain.on("window:close-overlay", () => closeOverlayWindow());
  electron.ipcMain.on("window:show-overlay", () => showOverlay());
  electron.ipcMain.on("window:hide-overlay", () => hideOverlay());
  electron.ipcMain.on("window:enter-overlay-mode", () => {
    console.log("[petmii] IPC: enter-overlay-mode received");
    const main = getMainWindow();
    if (main) {
      main.minimize();
    }
    showOverlay();
  });
  electron.ipcMain.on("window:exit-overlay-mode", () => {
    hideOverlay();
    restoreMainWindow();
  });
  electron.ipcMain.on("window:update-overlay", (_, variant) => {
    const overlay = getOverlayWindow();
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send("pet:variant-update", variant);
    }
  });
  electron.ipcMain.on("window:update-overlay-state", (_, petState) => {
    const overlay = getOverlayWindow();
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send("pet:state-update", petState);
    }
  });
  electron.ipcMain.handle("system:get-metrics", () => {
    const metrics = electron.app.getAppMetrics();
    const mainMemory = process.memoryUsage();
    return {
      processes: metrics.map((m) => ({
        pid: m.pid,
        type: m.type,
        name: m.name || m.type,
        cpu: {
          percentCPUUsage: m.cpu.percentCPUUsage
        },
        memory: {
          workingSetSize: m.memory.workingSetSize,
          // KB
          peakWorkingSetSize: m.memory.peakWorkingSetSize
          // KB
        }
      })),
      mainProcess: {
        rss: mainMemory.rss,
        heapUsed: mainMemory.heapUsed,
        heapTotal: mainMemory.heapTotal,
        external: mainMemory.external
      }
    };
  });
  electron.ipcMain.on("window:overlay-drag-start", (_, screenX, screenY) => {
    startDrag(screenX, screenY);
  });
  electron.ipcMain.on("window:overlay-drag-move", (_, screenX, screenY) => {
    moveDrag(screenX, screenY);
  });
  electron.ipcMain.on("window:overlay-drag-end", () => {
    endDrag();
  });
  electron.ipcMain.handle("graveyard:load", () => loadGraveyard());
  electron.ipcMain.handle("graveyard:remove", (_, id) => {
    removeFromGraveyard(id);
    return true;
  });
}
const SPECIES_TRAITS = {
  mochi: {
    decay: { hunger: 1, happiness: 0.8, energy: 1, cleanliness: 1.2, bond: 1 },
    stages: { babyToChild: 20, childToAdult: 60 },
    description: "Balanced, gets dirty easily"
  },
  blob: {
    decay: { hunger: 1.3, happiness: 1, energy: 0.7, cleanliness: 1, bond: 1 },
    stages: { babyToChild: 28, childToAdult: 96 },
    description: "Always hungry, but chill energy"
  },
  bun: {
    decay: { hunger: 0.8, happiness: 1.2, energy: 1, cleanliness: 1, bond: 1 },
    stages: { babyToChild: 16, childToAdult: 48 },
    description: "Eats less, needs more attention"
  },
  sprout: {
    decay: { hunger: 1, happiness: 1, energy: 1.3, cleanliness: 0.7, bond: 1 },
    stages: { babyToChild: 36, childToAdult: 120 },
    description: "Tires quickly, stays clean"
  },
  ghost: {
    decay: { hunger: 0.7, happiness: 1.3, energy: 1, cleanliness: 0.8, bond: 1 },
    stages: { babyToChild: 24, childToAdult: 72 },
    description: "Barely eats, emotionally needy"
  },
  star: {
    decay: { hunger: 1, happiness: 1, energy: 1, cleanliness: 1, bond: 1 },
    stages: { babyToChild: 24, childToAdult: 72 },
    description: "Perfectly balanced, no weakness"
  }
};
const PERSONALITY_TRAITS = {
  sweet: {
    decayMultipliers: { hunger: 1, happiness: 1.1, energy: 1, cleanliness: 1, bond: 0.7 },
    bondGainMultiplier: 1,
    description: "Bond decays 30% slower, happiness decays 10% faster"
  },
  chaotic: {
    decayMultipliers: { hunger: 1, happiness: 1, energy: 0.8, cleanliness: 1.4, bond: 1 },
    bondGainMultiplier: 1,
    description: "Cleanliness decays 40% faster, energy decays 20% slower"
  },
  sleepy: {
    decayMultipliers: { hunger: 0.85, happiness: 1, energy: 1.3, cleanliness: 1, bond: 1 },
    bondGainMultiplier: 1,
    description: "Energy decays 30% faster, hunger decays 15% slower"
  },
  curious: {
    decayMultipliers: { hunger: 1, happiness: 0.8, energy: 1.15, cleanliness: 1, bond: 1 },
    bondGainMultiplier: 1,
    description: "Happiness decays 20% slower, energy decays 15% faster"
  },
  shy: {
    decayMultipliers: { hunger: 1, happiness: 1, energy: 1, cleanliness: 0.8, bond: 1.4 },
    bondGainMultiplier: 1,
    description: "Bond decays 40% faster, cleanliness decays 20% slower"
  },
  sassy: {
    decayMultipliers: { hunger: 1, happiness: 1.15, energy: 1, cleanliness: 1, bond: 1 },
    bondGainMultiplier: 1.5,
    description: "Happiness decays 15% faster, bond gains +50% per interaction"
  }
};
const DECAY_TICK_MS = 6e4;
const BASE_DECAY = {
  hunger: 4,
  happiness: 2.5,
  energy: 2,
  cleanliness: 1.5,
  bond: 0.5
};
const HP_DAMAGE_RATE = 5;
const HP_DAMAGE_CRITICAL = 3;
const HP_RECOVERY_RATE = 2;
const STAGE_MULTIPLIERS = {
  egg: 0,
  baby: 1.5,
  child: 1,
  adult: 0.8
};
const MAX_CATCHUP_HOURS = 48;
let decayInterval = null;
function startDecayTimer() {
  stopDecayTimer();
  applyCatchUpDecay();
  decayInterval = setInterval(() => {
    tickDecay();
  }, DECAY_TICK_MS);
}
function stopDecayTimer() {
  if (decayInterval !== null) {
    clearInterval(decayInterval);
    decayInterval = null;
  }
}
function applyCatchUpDecay() {
  const pet = loadPetState();
  if (!pet || !pet.isAlive) return;
  const now = Date.now();
  const lastUpdate = new Date(pet.updatedAt).getTime();
  const elapsedMs = now - lastUpdate;
  const elapsedHours = Math.min(elapsedMs / (1e3 * 60 * 60), MAX_CATCHUP_HOURS);
  if (elapsedHours < 0.01) return;
  const updated = applyDecayForHours(pet, elapsedHours);
  savePetState(updated);
  broadcastState(updated);
}
function tickDecay() {
  const pet = loadPetState();
  if (!pet || !pet.isAlive) return;
  const tickHours = DECAY_TICK_MS / (1e3 * 60 * 60);
  const updated = applyDecayForHours(pet, tickHours);
  savePetState(updated);
  broadcastState(updated);
  if (!updated.isAlive) {
    handleDeath(updated);
  }
}
function applyDecayForHours(pet, hours) {
  let state = { ...pet };
  const speciesTraits = SPECIES_TRAITS[state.species];
  const personalityTraits = PERSONALITY_TRAITS[state.personality];
  const stageMultiplier = STAGE_MULTIPLIERS[state.lifeStage];
  const effectiveDecay = {
    hunger: BASE_DECAY.hunger * speciesTraits.decay.hunger * personalityTraits.decayMultipliers.hunger * stageMultiplier,
    happiness: BASE_DECAY.happiness * speciesTraits.decay.happiness * personalityTraits.decayMultipliers.happiness * stageMultiplier,
    energy: BASE_DECAY.energy * speciesTraits.decay.energy * personalityTraits.decayMultipliers.energy * stageMultiplier,
    cleanliness: BASE_DECAY.cleanliness * speciesTraits.decay.cleanliness * personalityTraits.decayMultipliers.cleanliness * stageMultiplier,
    bond: BASE_DECAY.bond * speciesTraits.decay.bond * personalityTraits.decayMultipliers.bond * stageMultiplier
  };
  if (state.hunger < 30) effectiveDecay.happiness *= 2;
  if (state.cleanliness < 20) effectiveDecay.happiness *= 1.5;
  if (state.energy < 15) effectiveDecay.hunger *= 1.5;
  if (state.happiness < 20) effectiveDecay.bond *= 2;
  state.hunger = clamp(state.hunger - effectiveDecay.hunger * hours);
  state.happiness = clamp(state.happiness - effectiveDecay.happiness * hours);
  state.energy = clamp(state.energy - effectiveDecay.energy * hours);
  state.cleanliness = clamp(state.cleanliness - effectiveDecay.cleanliness * hours);
  state.bond = clamp(state.bond - effectiveDecay.bond * hours);
  if (state.hunger <= 0) {
    state.hp = clamp(state.hp - HP_DAMAGE_RATE * hours);
  }
  if (state.happiness <= 0 && state.hunger < 10) {
    state.hp = clamp(state.hp - HP_DAMAGE_CRITICAL * hours);
  }
  if (state.hunger > 30 && state.happiness > 20 && state.hp < 100) {
    state.hp = clamp(state.hp + HP_RECOVERY_RATE * hours);
  }
  if (state.hp <= 0) {
    state.hp = 0;
    state.isAlive = false;
    state.diedAt = (/* @__PURE__ */ new Date()).toISOString();
    state.mood = "dead";
    state.lastMessage = "...";
  } else {
    state.mood = deriveMoodFromStats(state);
    state.lastMessage = deriveMessageFromStats(state);
  }
  state = checkLifeStageProgression(state);
  state.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  return state;
}
function checkLifeStageProgression(pet) {
  if (!pet.isAlive) return pet;
  const speciesTraits = SPECIES_TRAITS[pet.species];
  const ageHours = (Date.now() - new Date(pet.hatchedAt).getTime()) / (1e3 * 60 * 60);
  const canEvolve = pet.hunger > 20;
  if (pet.lifeStage === "baby" && ageHours >= speciesTraits.stages.babyToChild && canEvolve) {
    return { ...pet, lifeStage: "child", lastMessage: "Your pet grew into a child!" };
  }
  if (pet.lifeStage === "child" && ageHours >= speciesTraits.stages.babyToChild + speciesTraits.stages.childToAdult && canEvolve) {
    return { ...pet, lifeStage: "adult", lastMessage: "Your pet is now an adult!" };
  }
  return pet;
}
function deriveMoodFromStats(pet) {
  if (!pet.isAlive) return "dead";
  if (pet.hp < 40) return "sick";
  if (pet.hunger < 15) return "hungry";
  if (pet.energy < 15) return "sleepy";
  if (pet.happiness < 20) return "sad";
  if (pet.happiness > 70 && pet.hunger > 50 && pet.energy > 50) return "happy";
  if (pet.happiness > 60 && pet.energy > 60) return "playful";
  return "neutral";
}
function deriveMessageFromStats(pet) {
  if (pet.hp < 10) return "...";
  if (pet.hp < 25) return "I'm really struggling...";
  if (pet.hp < 50) return "Please take care of me...";
  if (pet.hp < 80) return "I'm not feeling great...";
  if (pet.hunger < 10) return "I'm starving!";
  if (pet.hunger < 25) return "I'm so hungry...";
  if (pet.energy < 10) return "I can barely keep my eyes open...";
  if (pet.energy < 25) return "I'm exhausted...";
  if (pet.cleanliness < 15) return "I feel so dirty...";
  if (pet.happiness < 15) return "I'm so lonely...";
  if (pet.happiness < 30) return "Play with me?";
  if (pet.bond > 80 && pet.happiness > 70) return "I love being with you!";
  if (pet.happiness > 80) return "Life is wonderful!";
  return "~";
}
function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}
function handleDeath(pet) {
  saveToGraveyard(pet);
  for (const win of electron.BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("pet:died", pet);
    }
  }
}
function broadcastState(pet) {
  for (const win of electron.BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("pet:state-update", pet);
    }
  }
}
electron.app.disableHardwareAcceleration();
electron.app.commandLine.appendSwitch("disable-gpu");
electron.app.commandLine.appendSwitch("disable-gpu-compositing");
electron.app.commandLine.appendSwitch("disable-gpu-sandbox");
electron.app.commandLine.appendSwitch("disable-software-rasterizer");
electron.app.commandLine.appendSwitch("no-sandbox");
electron.app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling,MediaSessionService");
electron.app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();
  startDecayTimer();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
