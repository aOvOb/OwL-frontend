import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import admin from "./admin/version.json";

declare const process: { env: Record<string, string | undefined> }; // Node global (no @types/node needed)

const BUILD_ID = (process.env.GITHUB_SHA ?? "").slice(0, 7) || `dev-${Date.now()}`;

/**
 * The admin app (admin/index.html, served on the admin domain). Built and deployed separately from the
 * music app, so a change to the admin screens does not ship a new music app (which would reload on
 * people's devices). It shares src/ (API calls, components, styles) with the music app.
 * Version: admin/version.json, changes: admin/CHANGELOG.md.
 */
export default defineConfig({
  root: "admin",
  publicDir: "../public",
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID), __APP_VERSION__: JSON.stringify(admin.version) },
  plugins: [react()],
  build: { outDir: "../dist-admin", emptyOutDir: true },
  server: {
    port: 5174,
    proxy: {
      "/api": { target: "https://admin.aovob7.duckdns.org", changeOrigin: true, cookieDomainRewrite: "localhost" },
    },
  },
});
