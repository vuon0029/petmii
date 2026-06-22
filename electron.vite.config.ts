import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      "process.env.PETMII_TEST_MODE": JSON.stringify(process.env.PETMII_TEST_MODE || ""),
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "src/main/main.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          preload: resolve(__dirname, "src/preload/preload.ts"),
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    envPrefix: ["PETMII_"],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "src/renderer/index.html"),
          overlay: resolve(__dirname, "src/renderer/overlay.html"),
        },
      },
      assetsInlineLimit: 0,
    },
  },
});
