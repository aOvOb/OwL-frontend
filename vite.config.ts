import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
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
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        runtimeCaching: [
          {
            // Cover images: cache-first, they never change for an id.
            urlPattern: ({ url }) => url.pathname.startsWith("/api/cover/"),
            handler: "CacheFirst",
            options: {
              cacheName: "covers",
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    // Local development against the real server: `npm run dev`, then log in.
    proxy: {
      "/api": { target: "https://owl.aovob7.duckdns.org", changeOrigin: true, cookieDomainRewrite: "localhost" },
    },
  },
});
