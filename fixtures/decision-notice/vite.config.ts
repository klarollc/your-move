import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The Phase 5 Decision Notice fixture, served on its own (Phase 5 fixture removal, D-2). It left the
 * production office bundle by owner ruling; decision 9-E still holds, so the Phase 5 browser suites
 * load this fixture's production build, on 4175, never a dev server.
 */
export default defineConfig({
  plugins: [react()],
  preview: {
    host: "127.0.0.1",
    port: 4175,
    strictPort: true,
  },
});
