import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// PWA config — makes the dashboard installable to home screen on iOS/Android
// and lets the brand identity (gold A on dark) appear as the app icon.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.svg", "pwa-icon.svg"],
      manifest: {
        name: "AzQueue · Flow Management",
        short_name: "AzQueue",
        description: "Walk-ins and bookings, in one queue.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0b0b0c",
        theme_color: "#c9a86a",
        orientation: "any",
        icons: [
          { src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        // Don't cache the auth or realtime endpoints — always go to network
        navigateFallbackDenylist: [/^\/api/, /\/auth\/v1/, /\/realtime\/v1/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: { cacheName: "images", expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "fonts" },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    // Allow tunneled hosts (Cloudflare Tunnel, ngrok, localtunnel) during dev so
    // we can test on phones without manually adding each fresh subdomain.
    allowedHosts: [
      "localhost",
      ".trycloudflare.com",
      ".ngrok-free.app",
      ".ngrok.io",
      ".loca.lt",
    ],
  },
});
