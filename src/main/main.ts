import { app, BrowserWindow, Tray, Menu, nativeImage } from "electron";
import path from "path";
import { registerIpcHandlers } from "./ipcHandlers";
import { createMainWindow, getMainWindow } from "./windowManager";
import { startDecayTimer } from "./statDecay";

// WSL2/Linux: Must disable hardware acceleration before app is ready
// when /dev/dri (GPU) is not available
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling,MediaSessionService");

let tray: Tray | null = null;

function createTray(): void {
  const iconPath = path.join(__dirname, "../../build/icon.ico");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show petmii",
      click: () => {
        const main = getMainWindow();
        if (main) {
          main.show();
          main.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        (app as { isQuitting?: boolean }).isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("petmii");
  tray.setContextMenu(contextMenu);

  // Click tray icon to show/hide main window
  tray.on("click", () => {
    const main = getMainWindow();
    if (main) {
      if (main.isVisible()) {
        main.hide();
      } else {
        main.show();
        main.focus();
      }
    }
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

// Don't quit when all windows are closed — keep running in tray
app.on("window-all-closed", () => {
  // Do nothing — app stays in system tray
});
