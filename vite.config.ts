import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "frontend",
  plugins: [react()],
  build: {
    outDir: "../dist/web",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      "/approvals": "http://localhost:3333",
      "/jobs": "http://localhost:3333",
      "/health": "http://localhost:3333"
    }
  }
});
