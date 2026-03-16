import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Vite plugin: serves /api/screenshot?url=... using a local Puppeteer instance.
// Only active during dev (configureServer is ignored by the build).
function screenshotPlugin() {
  return {
    name: "screenshot-api",
    configureServer(server) {
      server.middlewares.use("/api/screenshot", async (req, res) => {
        const qs = new URL(req.url, "http://localhost").searchParams;
        const url = qs.get("url");
        if (!url) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "url parameter required" }));
          return;
        }
        try {
          const { default: puppeteer } = await import("puppeteer");
          const browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
          });
          const page = await browser.newPage();
          await page.setViewport({ width: 1440, height: 900 });
          await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

          // Cap at 2 000 px tall so the image stays manageable for Claude
          const captureH = await page.evaluate(() =>
            Math.min(document.body.scrollHeight, 2000)
          );
          await page.setViewport({ width: 1440, height: captureH });

          const buf = await page.screenshot({ type: "jpeg", quality: 82 });
          await browser.close();

          // Puppeteer 22+ returns Uint8Array; Buffer.from handles both Buffer and Uint8Array
          const dataUrl = `data:image/jpeg;base64,${Buffer.from(buf).toString("base64")}`;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ dataUrl }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), screenshotPlugin()],
    server: {
      proxy: {
        "/api/anthropic": {
          target: "https://api.anthropic.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ""),
          headers: {
            "x-api-key":                                 env.VITE_ANTHROPIC_API_KEY,
            "anthropic-version":                         "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
        },
        "/api/convert": {
          target: "https://api.convert.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/convert/, ""),
        },
      },
    },
  };
});
