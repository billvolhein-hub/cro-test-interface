import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/anthropic": {
        target: "https://api.anthropic.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ""),
      },
      "/api/convert": {
        target: "https://api.convert.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/convert/, ""),
      },
    },
  },
});
