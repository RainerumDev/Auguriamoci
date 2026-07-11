import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves the app from /<repo-name>/. Override with BASE_PATH=/ for
// local preview at the root.
const base = process.env.BASE_PATH ?? "/Auguriamoci/";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Google APIs are fetched by the in-app sync loop and cached in
        // IndexedDB, never by the service worker.
        navigateFallback: "index.html",
      },
      manifest: {
        name: "Auguriamoci - Digital Signage",
        short_name: "Auguriamoci",
        description:
          "Digital signage per compleanni, onomastici, eventi da calendario e media da Google Drive.",
        display: "fullscreen",
        orientation: "landscape",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        start_url: base,
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
