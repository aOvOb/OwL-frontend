import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json";

declare const process: { env: Record<string, string | undefined> }; // Node global (no @types/node needed)

// Build id: the commit in CI, a timestamp locally. Shipped as /version.json so an old cached app can
// tell that a newer version is on the server.
const BUILD_ID = (process.env.GITHUB_SHA ?? "").slice(0, 7) || `dev-${Date.now()}`;

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID), __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    {
      name: "owl-version-file",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version: pkg.version, build: BUILD_ID }) });
      },
    },
    VitePWA({
      registerType: "autoUpdate",
      // Own service worker (src/sw.ts): saved songs are served from the device, with byte ranges for seeking.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // The admin app (admin.html, its own domain) is not part of the music app's offline files.
      injectManifest: { globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"], globIgnores: ["admin.html", "**/admin-*.js"] },
      includeAssets: ["icons/apple-touch-icon.png", "icons/favicon-64.png"],
      manifest: {
        name: "OwL",
        short_name: "OwL",
        description: "나만의 음악 스트리밍",
        lang: "ko",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0c0809",
        theme_color: "#0c0809",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  // Two pages: the music app (index.html) and the admin app (admin.html, served on the admin domain).
  build: { rollupOptions: { input: { main: "index.html", admin: "admin.html" } } },
  server: {
    // Local development against the real server: `npm run dev`, then log in.
    proxy: {
      "/api": { target: "https://owl.aovob7.duckdns.org", changeOrigin: true, cookieDomainRewrite: "localhost" },
    },
  },
});
