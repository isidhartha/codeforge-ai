import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import monacoEditorPlugin from "vite-plugin-monaco-editor";

export default defineConfig({
  plugins: [
    react(),
    (monacoEditorPlugin as any).default({
      languageWorkers: [
        "editorWorkerService",
        "typescript",
        "json",
        "css",
        "html",
      ],
    }),
  ],
  server: {
    port: 3006,
    proxy: {
      "/api": {
        target: "http://localhost:8006",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8006",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ["@monaco-editor/react"],
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ["monaco-editor"],
          react: ["react", "react-dom"],
          xterm: ["xterm", "xterm-addon-fit"],
        },
      },
    },
  },
});
