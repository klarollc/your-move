import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  /**
   * Decision 9-E. The Phase 5 captures are taken against the built bundle on 4174, not the dev
   * server on 4173. C-11 asks for an auditable network panel, and a dev-server page issues ninety-
   * five module requests per journey — a panel nobody reads is not an audit. The preview serves what
   * actually ships.
   */
  preview: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
});
