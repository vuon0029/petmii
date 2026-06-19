import { app, BrowserWindow, Tray, Menu, nativeImage } from "electron";
import path from "path";
import { registerIpcHandlers } from "./ipcHandlers";
import {
  closeOverlayWindow,
  createMainWindow,
  getMainWindow,
  restoreMainWindow,
  showOverlay,
  hideOverlay,
  isOverlayVisible,
} from "./windowManager";
import { startDecayTimer } from "./statDecay";

// WSL2/Linux: Must disable hardware acceleration before app is ready
// when /dev/dri (GPU) is not available
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch(
  "disable-features",
  "HardwareMediaKeyHandling,MediaSessionService",
);

let tray: Tray | null = null;
let isQuitting = false;

function cleanupTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

function quitApp(): void {
  console.log("[petmii] Quitting app...");

  isQuitting = true;
  (app as { isQuitting?: boolean }).isQuitting = true;

  // Important: kill overlay first because it is frameless/skipTaskbar/closable:false
  closeOverlayWindow();

  const main = getMainWindow();
  if (main && !main.isDestroyed()) {
    main.destroy();
  }

  cleanupTray();

  // Force full process exit after manual cleanup
  app.exit(0);
}

function getTrayIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "icon.ico");
  }

  return path.join(process.cwd(), "build", "icon.ico");
}

function createTray(): void {
  const iconPath = getTrayIconPath();

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open petmii",
      click: () => {
        if (isQuitting) return;
        restoreMainWindow();
      },
    },
    {
      label: "Toggle Overlay",
      click: () => {
        if (isQuitting) return;
        if (isOverlayVisible()) {
          hideOverlay();
        } else {
          showOverlay();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: quitApp,
    },
  ]);

  tray.setToolTip("petmii");
  tray.setContextMenu(contextMenu);

  // Click tray icon to show/hide main window
  tray.on("click", () => {
    if (isQuitting) return;
    restoreMainWindow();
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();
  createTray();
  startDecayTimer();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  (app as { isQuitting?: boolean }).isQuitting = true;

  closeOverlayWindow();
  cleanupTray();
});

// Don't quit when all windows are closed — keep running in tray
app.on("window-all-closed", () => {
  if (isQuitting) {
    app.exit(0);
  }
});
