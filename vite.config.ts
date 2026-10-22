import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// Speed: the homepage hero (LCP image) comes from Supabase and was only
// requested after ~270KB of JS ran + a DB query. At build time we look up the
// first visible hero slide and inject a tiny inline script that preloads it
// on "/" only, so the browser fetches it in parallel with the JS.
function heroPreloadPlugin() {
  return {
    name: "hero-preload",
    apply: "build" as const,
    async transformIndexHtml(html: string) {
      const url = process.env.VITE_SUPABASE_URL;
      const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) return html;
      try {
        const r = await fetch(
          `${url}/rest/v1/homepage_hero_slides?select=image_url&is_visible=eq.true&image_url=not.is.null&order=display_order.asc&limit=1`,
          { headers: { apikey: key, Authorization: `Bearer ${key}` } },
        );
        const rows = (await r.json()) as { image_url?: string }[];
        const img = Array.isArray(rows) && rows[0]?.image_url;
        if (!img || !/^https:\/\//.test(img)) return html;
        const tag = `<script>if(location.pathname==="/"){var l=document.createElement("link");l.rel="preload";l.as="image";l.href=${JSON.stringify(img)};l.setAttribute("fetchpriority","high");document.head.appendChild(l);}</script>`;
        return html.replace("</title>", "</title>\n    " + tag);
      } catch {
        return html;
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env });
  return {
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mcpPlugin(), heroPreloadPlugin(), mode === "development" && componentTagger()].filter(Boolean),
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
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("vaul")) return "ui";
          if (id.includes("react-router")) return "router";
          if (id.includes("@tanstack")) return "query";
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
};
});
