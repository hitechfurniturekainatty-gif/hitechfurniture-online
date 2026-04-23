import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // Split big third-party libs into their own long-cacheable chunks so:
    //   - first paint downloads less JS
    //   - public visitors never download the PDF renderer
    //   - browser cache survives across deploys when only app code changes
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return;
          if (id.includes("@react-pdf")) return "pdf";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("vaul")) return "ui";
          if (id.includes("react-router")) return "router";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
        },
        // pdf.js workers imported via `new URL(..., import.meta.url)` are
        // emitted as assets. Some hosts serve `.mjs` worker assets with the
        // wrong MIME type, so rename only emitted `.mjs` assets to `.js`.
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || "";
          if (name.endsWith(".mjs")) {
            return "assets/[name]-[hash].js";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
    // Don't warn until a chunk is genuinely huge
    chunkSizeWarningLimit: 1200,
  },
}));
