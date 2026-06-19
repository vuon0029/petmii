// src/main/windowManager.ts
// Window management for main and overlay windows.
// Phase 2: Overlay is full-screen-width, short height, anchored at bottom.
// Pet movement/physics handled entirely in the renderer via CSS transforms.

import { BrowserWindow, screen } from "electron";
import path from "path";
import { loadGameState } from "./petStorage";

const APP_ICON = path.join(__dirname, "../../build/icon.ico");

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let overlayVisible = false;

// Overlay is full-screen height for unrestricted pet throwing

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 780,
    title: "petmii",
    icon: APP_ICON,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
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
    // Overlay is now a toggle — do NOT hide on focus
  });

  // No auto-show on blur — overlay is manual toggle only

  // No auto-show on minimize — overlay is manual toggle only

  mainWindow.on("restore", () => {
    // No auto-hide on restore — overlay is manual toggle only
  });

  // Destroy main window to free memory when user closes (tray keeps app alive)
  mainWindow.on("close", (e) => {
    const { app } = require("electron");
    if (!(app as { isQuitting?: boolean }).isQuitting) {
      e.preventDefault();
      mainWindow?.destroy();
      mainWindow = null;
    }
  });

  return mainWindow;
}

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    x: 0,
    y: 0,
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
  // Don't use setIgnoreMouseEvents — causes rendering issues.
  // CSS pointer-events handles click-through instead.
  overlayWindow.setIgnoreMouseEvents(false);

  overlayWindow.on("blur", () => {
    if (overlayWindow && !overlayWindow.isDestroyed() && overlayVisible) {
      overlayWindow.setAlwaysOnTop(true, "screen-saver");
    }
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
    overlayVisible = false;
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

// ===== Show / Hide / Close =====

export function showOverlay(): void {
  overlayVisible = true;
  const overlay = createOverlayWindow();

  overlay.hide();
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.showInactive();
  overlay.setAlwaysOnTop(true, "screen-saver");

  setTimeout(() => {
    if (overlay && !overlay.isDestroyed()) {
      overlay.setAlwaysOnTop(true, "screen-saver");
      overlay.moveTop();
    }
  }, 200);

  // Send game state to overlay
  const game = loadGameState();
  if (overlay.webContents) {
    const sendData = () => {
      if (overlay.isDestroyed()) return;
      overlay.webContents.send("game:state-update", game);
    };

    if (overlay.webContents.isLoading()) {
      overlay.webContents.once("did-finish-load", sendData);
    } else {
      sendData();
    }

    // Resend after a delay to ensure overlay renderer has mounted
    setTimeout(() => {
      if (!overlay.isDestroyed()) {
        overlay.webContents.send("game:state-update", loadGameState());
      }
    }, 500);
  }
}

export function hideOverlay(): void {
  overlayVisible = false;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
}

export function closeOverlayWindow(): void {
  overlayVisible = false;

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
  }

  overlayWindow = null;
}

export function restoreMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
  } else {
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
