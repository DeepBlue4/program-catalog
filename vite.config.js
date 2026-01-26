import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : '/ui/program-catalog/',
  plugins: [vue()],
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
      },
    },
  },
}));
