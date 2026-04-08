import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_TABLES = ["clients", "tests", "agencies", "platform_config"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { table, action, ...payload } = req.body ?? {};
  if (!table || !action) return res.status(400).json({ error: "Missing table or action" });
  if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: "Table not allowed" });

  try {
    const result = await run(table, action, payload);
    res.status(200).json(result ?? null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function run(table, action, payload) {
  const ref = supabase.from(table);

  if (action === "select") {
    let q = ref.select(payload.select ?? "*");
    for (const [col, val] of Object.entries(payload.filters ?? {})) q = q.eq(col, val);
    if (payload.order) q = q.order(payload.order.col, { ascending: payload.order.asc ?? true });
    if (payload.single) q = q.single();
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  if (action === "insert") {
    let q = ref.insert(payload.data).select();
    if (payload.single) q = q.single();
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  if (action === "update") {
    let q = ref.update(payload.data);
    for (const [col, val] of Object.entries(payload.filters ?? {})) q = q.eq(col, val);
    if (payload.select) {
      q = q.select(payload.select);
      if (payload.single) q = q.single();
    }
    const { data, error } = await q;
    if (error) throw error;
    return data ?? null;
  }

  if (action === "delete") {
    let q = ref.delete();
    for (const [col, val] of Object.entries(payload.filters ?? {})) q = q.eq(col, val);
    const { error } = await q;
    if (error) throw error;
    return null;
  }

  if (action === "upsert") {
    const opts = payload.onConflict ? { onConflict: payload.onConflict } : {};
    const { data, error } = await ref.upsert(payload.data, opts);
    if (error) throw error;
    return data;
  }

  throw new Error(`Unknown action: ${action}`);
}
