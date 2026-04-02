import { useEffect, useRef, useState } from "react";

// ── Helpers ────────────────────────────────────────────────────────────────────
function nodeColor(n) {
  const status = String(n.status ?? "");
  if (!status || status === "0") return "#6B7280"; // unknown / not crawled — grey
  if (status.startsWith("3")) return "#F59E0B";    // redirect — amber
  if (status.startsWith("4")) return "#DC2626";    // 4xx — red
  if (status.startsWith("5")) return "#7C3AED";    // 5xx — purple
  if (status === "200" && n.index) {
    const greens = ["#16A34A", "#22C55E", "#4ADE80", "#86EFAC", "#BBF7D0"];
    return greens[Math.min(n.depth ?? 0, greens.length - 1)];
  }
  return "#DC2626"; // 200 but non-indexable (noindex, canonical, etc.)
}

function buildGraph(rawNodes) {
  if (!rawNodes?.length) return { nodes: [], links: [] };

  let origin = "";
  try { origin = new URL(rawNodes[0].url).origin; } catch { origin = "root"; }

  const urlSet = new Set(rawNodes.map(n => n.url));
  const gNodes = [{ id: origin, url: origin, title: origin, status: "200", index: true, depth: 0, inlinks: 0 }];
  rawNodes.forEach(n => gNodes.push({ ...n, id: n.url }));

  const links = [];
  rawNodes.forEach(n => {
    let parentId = origin;
    try {
      const u = new URL(n.url);
      const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
      if (parts.length > 0) {
        for (let i = parts.length - 1; i >= 0; i--) {
          if (i === 0) { parentId = origin; break; }
          const c1 = `${u.origin}/${parts.slice(0, i).join("/")}`;
          const c2 = `${u.origin}/${parts.slice(0, i).join("/")}/`;
          if (urlSet.has(c1)) { parentId = c1; break; }
          if (urlSet.has(c2)) { parentId = c2; break; }
        }
      }
    } catch { /* keep origin */ }
    if (parentId !== n.url) links.push({ source: parentId, target: n.url });
  });

  return { nodes: gNodes, links };
}

// ── Legend ─────────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { color: "#16A34A", label: "Indexable (depth 0–1)" },
    { color: "#4ADE80", label: "Indexable (depth 2–3)" },
    { color: "#86EFAC", label: "Indexable (depth 4+)" },
    { color: "#F59E0B", label: "Redirect (3xx)" },
    { color: "#DC2626", label: "Non-indexable / 4xx" },
    { color: "#7C3AED", label: "Server Error (5xx)" },
    { color: "#6B7280", label: "Unknown / not crawled" },
  ];
  return (
    <div style={{ position: "absolute", bottom: 24, left: 24, background: "rgba(0,0,0,.72)", borderRadius: 8, padding: "12px 16px", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,.12)" }}>
      {items.map(({ color, label }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#D1D5DB", fontFamily: "'Inter',sans-serif" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────────
function StatsBar({ nodes }) {
  if (!nodes?.length) return null;
  const indexable    = nodes.filter(n => String(n.status) === "200" && n.index).length;
  const nonIndexable = nodes.length - indexable;
  const avgDepth     = (nodes.reduce((s, n) => s + (n.depth ?? 0), 0) / nodes.length).toFixed(1);
  const orphans      = nodes.filter(n => n.inlinks === 0 && (n.depth ?? 0) > 0).length;
  const stats = [
    { label: "Total URLs",    value: nodes.length.toLocaleString() },
    { label: "Indexable",     value: indexable.toLocaleString(),    color: "#4ADE80" },
    { label: "Non-indexable", value: nonIndexable.toLocaleString(), color: "#FCA5A5" },
    { label: "Avg Depth",     value: avgDepth },
    { label: "Orphaned",      value: orphans.toLocaleString(),      color: "#FCD34D" },
  ];
  return (
    <div style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 2, background: "rgba(0,0,0,.72)", borderRadius: 8, padding: "8px 16px", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,.12)", whiteSpace: "nowrap" }}>
      {stats.map(({ label, value, color }, i) => (
        <div key={label} style={{ textAlign: "center", padding: "0 14px", borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,.12)" : "none" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: color || "#F9FAFB", fontFamily: "'Inter',sans-serif" }}>{value}</div>
          <div style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "'Inter',sans-serif", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Tooltip — rendered at mouse position, coloured to match node ───────────────
function Tooltip({ node, pos }) {
  if (!node) return null;
  const color = nodeColor(node);
  const isIndexable = String(node.status) === "200" && node.index;
  return (
    <div style={{
      position: "fixed",
      left: pos.x + 14,
      top: pos.y - 10,
      background: color,
      borderRadius: 8,
      padding: "10px 14px",
      maxWidth: 340,
      pointerEvents: "none",
      zIndex: 9999,
      boxShadow: "0 4px 24px rgba(0,0,0,.5)",
      border: "1px solid rgba(255,255,255,.2)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", wordBreak: "break-all", marginBottom: node.title ? 4 : 6, fontFamily: "'Inter',sans-serif", lineHeight: 1.4 }}>
        {node.url}
      </div>
      {node.title && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.85)", marginBottom: 6, fontFamily: "'Inter',sans-serif" }}>
          {node.title}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px" }}>
        {[
          ["Status",    node.status || "—"],
          ["Depth",     node.depth ?? 0],
          ["Inlinks",   node.inlinks ?? 0],
          ["Indexable", isIndexable ? "Yes" : "No"],
        ].map(([k, v]) => (
          <span key={k} style={{ fontSize: 10, color: "rgba(255,255,255,.95)", fontFamily: "'Inter',sans-serif" }}>
            <b>{k}:</b> {v}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────
export default function DirectoryTreeModal({ nodes: rawNodes, onClose }) {
  const mountRef    = useRef(null);
  const graphRef    = useRef(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos,  setTooltipPos]  = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  // Track real mouse position separately — onNodeHover's 2nd arg is prevNode, not an event
  useEffect(() => {
    const onMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      setTooltipPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { default: ForceGraph3D } = await import("3d-force-graph");
      if (cancelled || !mountRef.current) return;

      const graphData = buildGraph(rawNodes);

      const fg = ForceGraph3D({ antialias: true, alpha: false })(mountRef.current)
        .width(mountRef.current.clientWidth)
        .height(mountRef.current.clientHeight)
        .backgroundColor("#1a1a2e")
        .graphData(graphData)
        .nodeLabel(() => "")
        .nodeColor(n => nodeColor(n))
        .nodeOpacity(0.92)
        .nodeVal(n => Math.max(1, (n.inlinks || 0) * 0.4 + 1.5))
        .linkColor(() => "rgba(255,255,255,0.55)")
        .linkWidth(0.8)
        .linkOpacity(0.9)
        .onNodeHover(node => {
          setHoveredNode(node || null);
          if (mountRef.current) mountRef.current.style.cursor = node ? "pointer" : "default";
        })
        .onNodeClick(node => {
          if (node.url && node.url !== node.id) window.open(node.url, "_blank");
        });

      setTimeout(() => { if (!cancelled) { fg.zoomToFit(800, 80); setReady(true); } }, 2500);
      graphRef.current = fg;
    })();

    const onResize = () => {
      if (graphRef.current && mountRef.current)
        graphRef.current.width(mountRef.current.clientWidth).height(mountRef.current.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      try { graphRef.current?._destructor?.(); } catch {}
      graphRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#1a1a2e", fontFamily: "'Inter',sans-serif" }}>
      {/* Top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", background: "rgba(0,0,0,.5)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#F9FAFB" }}>Site Directory Tree</div>
          <div style={{ fontSize: 10, color: "#6B7280" }}>3D Force-Directed Graph · click a node to open URL</div>
        </div>
        <button onClick={() => graphRef.current?.zoomToFit(600, 80)}
          style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", color: "#D1D5DB", padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
          Zoom to Fit
        </button>
        <button onClick={onClose}
          style={{ background: "rgba(220,38,38,.15)", border: "1px solid rgba(220,38,38,.3)", color: "#FCA5A5", padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
          ✕ Close
        </button>
      </div>

      <StatsBar nodes={rawNodes} />

      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {!ready && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
          <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,.1)", borderTopColor: "#4ADE80", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 16 }} />
          <div style={{ color: "#9CA3AF", fontSize: 12 }}>Building graph…</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      <Legend />

      <Tooltip node={hoveredNode} pos={tooltipPos} />

      <div style={{ position: "absolute", bottom: 24, right: 24, fontSize: 10, color: "#4B5563", textAlign: "right", lineHeight: 1.8 }}>
        Left-click + drag · Scroll to zoom · Right-click to pan
      </div>
    </div>
  );
}
