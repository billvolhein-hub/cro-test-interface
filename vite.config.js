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

// Shared: read + parse JSON request body from a Node IncomingMessage
async function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try { resolve(JSON.parse(raw)); }
      catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

function dbPlugin(env) {
  return {
    name: "db-api",
    configureServer(server) {
      server.middlewares.use("/api/db", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (req.method !== "POST") { res.statusCode = 405; res.end(JSON.stringify({ error: "Method not allowed" })); return; }

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        const ALLOWED_TABLES = ["clients", "tests", "agencies", "platform_config"];
        const { table, action, ...payload } = await readJsonBody(req);

        if (!table || !action || !ALLOWED_TABLES.includes(table)) {
          res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid table or action" })); return;
        }

        try {
          const ref = supabase.from(table);
          let result = null;

          if (action === "select") {
            let q = ref.select(payload.select ?? "*");
            for (const [col, val] of Object.entries(payload.filters ?? {})) q = q.eq(col, val);
            if (payload.order) q = q.order(payload.order.col, { ascending: payload.order.asc ?? true });
            if (payload.single) q = q.single();
            const { data, error } = await q;
            if (error) throw error;
            result = data;
          } else if (action === "insert") {
            let q = ref.insert(payload.data).select();
            if (payload.single) q = q.single();
            const { data, error } = await q;
            if (error) throw error;
            result = data;
          } else if (action === "update") {
            let q = ref.update(payload.data);
            for (const [col, val] of Object.entries(payload.filters ?? {})) q = q.eq(col, val);
            if (payload.select) { q = q.select(payload.select); if (payload.single) q = q.single(); }
            const { data, error } = await q;
            if (error) throw error;
            result = data ?? null;
          } else if (action === "delete") {
            let q = ref.delete();
            for (const [col, val] of Object.entries(payload.filters ?? {})) q = q.eq(col, val);
            const { error } = await q;
            if (error) throw error;
          } else if (action === "upsert") {
            const opts = payload.onConflict ? { onConflict: payload.onConflict } : {};
            const { data, error } = await ref.upsert(payload.data, opts);
            if (error) throw error;
            result = data;
          } else {
            res.statusCode = 400; res.end(JSON.stringify({ error: `Unknown action: ${action}` })); return;
          }

          res.end(JSON.stringify(result ?? null));
        } catch (err) {
          res.statusCode = 500; res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

function uploadPlugin(env) {
  return {
    name: "upload-api",
    configureServer(server) {
      server.middlewares.use("/api/upload", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (req.method !== "POST") { res.statusCode = 405; res.end(JSON.stringify({ error: "Method not allowed" })); return; }

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        const ALLOWED_BUCKETS = ["screenshots", "agency-logos"];
        const { action, bucket, ...payload } = await readJsonBody(req);

        if (!bucket || !ALLOWED_BUCKETS.includes(bucket)) {
          res.statusCode = 400; res.end(JSON.stringify({ error: "Bucket not allowed" })); return;
        }

        try {
          if (action === "upload") {
            const { path, dataUrl, contentType } = payload;
            const buf = Buffer.from(dataUrl.replace(/^data:[^;]+;base64,/, ""), "base64");
            const { error } = await supabase.storage.from(bucket).upload(path, buf, { upsert: true, contentType: contentType ?? "application/octet-stream" });
            if (error) throw error;
            const { data } = supabase.storage.from(bucket).getPublicUrl(path);
            res.end(JSON.stringify({ publicUrl: data.publicUrl }));
          } else if (action === "list") {
            const { data, error } = await supabase.storage.from(bucket).list(payload.prefix ?? "");
            if (error) throw error;
            res.end(JSON.stringify(data ?? []));
          } else if (action === "remove") {
            if (payload.paths?.length) await supabase.storage.from(bucket).remove(payload.paths);
            res.end(JSON.stringify({ ok: true }));
          } else {
            res.statusCode = 400; res.end(JSON.stringify({ error: `Unknown action: ${action}` }));
          }
        } catch (err) {
          res.statusCode = 500; res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

function ahrefsPlugin(env) {
  return {
    name: "ahrefs-api",
    configureServer(server) {
      server.middlewares.use("/api/ahrefs", async (req, res) => {
        const params = Object.fromEntries(new URL(req.url, "http://localhost").searchParams);
        const { endpoint, ...rest } = params;
        const key = env.AHREFS_API_KEY;

        res.setHeader("Content-Type", "application/json");

        if (!endpoint) { res.statusCode = 400; res.end(JSON.stringify({ error: "endpoint required" })); return; }
        if (!key)      { res.statusCode = 500; res.end(JSON.stringify({ error: "AHREFS_API_KEY not set in .env" })); return; }

        const qs  = new URLSearchParams(rest).toString();
        const url = `https://api.ahrefs.com/v3/site-explorer/${endpoint}${qs ? "?" + qs : ""}`;

        try {
          const r    = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } });
          const data = await r.json();
          res.statusCode = r.status;
          res.end(JSON.stringify(data));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), screenshotPlugin(), ahrefsPlugin(env), dbPlugin(env), uploadPlugin(env)],
    build: {
      target: "es2020",
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/3d-force-graph") || id.includes("node_modules/three-spritetext") || id.includes("node_modules/three/"))
              return "vendor-3d";
            if (id.includes("node_modules/jspdf") || id.includes("node_modules/html2canvas") || id.includes("node_modules/stackblur") || id.includes("node_modules/canvg"))
              return "vendor-pdf";
            if (id.includes("node_modules/recharts") || id.includes("node_modules/victory-vendor") || id.includes("node_modules/d3-"))
              return "vendor-charts";
            if (id.includes("node_modules/jszip") || id.includes("node_modules/docx") || id.includes("node_modules/file-saver"))
              return "vendor-docs";
            if (id.includes("node_modules/exceljs"))
              return "vendor-excel";
            if (id.includes("node_modules/@supabase"))
              return "vendor-supabase";
            if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/react-router"))
              return "vendor-react";
          },
        },
      },
    },
    server: {
      proxy: {
        "/api/anthropic": {
          target: "https://api.anthropic.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ""),
          headers: {
            "x-api-key":                                 env.ANTHROPIC_API_KEY,
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
