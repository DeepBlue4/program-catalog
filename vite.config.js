import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: "/ui/program-catalog/",
  resolve: {
    alias: {
      src: "/src",
    },
  },
  server: {
    port: 8002,
    host: true,

    proxy: {
      // Proxy all requests starting with /ui to http://localhost:8000
      "/ui": {
        target: "http://localhost:8000",
        changeOrigin: true,
        bypass: (req, res, options) => {
          const accept = req.headers.accept || "";
          const url = req.url;
          // Bypass proxy for:
          // 1. HTML requests (allow Vite to serve index.html)
          // 2. Vite internal client scripts (@vite)
          // 3. Source files (src/, node_modules/)
          // 4. Static assets with extensions (.js, .css, .png, .svg, .vue, .json)
          if (
            accept.includes("text/html") ||
            url.includes("@vite") ||
            url.includes("@id") ||
            url.includes("__x00__") ||
            url.includes("/src/") ||
            url.includes("/node_modules/") ||
            /\.(js|css|png|svg|vue|json|ico)$/.test(url.split("?")[0])
          ) {
            return url;
          }
        },
      },
    },
  },
  build: {
    // Output directly to the Django static directory
    outDir: "backend/static/program-catalog-app",
    emptyOutDir: true,
  },
});
