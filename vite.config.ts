import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  optimizeDeps: {
    include: ["jsbarcode"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["node_modules", "dist", "e2e"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:9003",
        changeOrigin: true,
      },
      // Avoid CORS with Keycloak in dev: browser calls same origin, Vite forwards to Keycloak
      "/keycloak": {
        target: "http://localhost:8088",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/keycloak/, ""),
      },
    },
  },
});
