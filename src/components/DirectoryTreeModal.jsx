import { useEffect, useRef, useState } from "react";

// ── Helpers ────────────────────────────────────────────────────────────────────
function nodeColor(n) {
  if (!n.index) {
    const s = String(n.status);
    if (s.startsWith("3")) return "#F59E0B"; // redirect — amber
    if (s.startsWith("4")) return "#DC2626"; // 4xx — red
    if (s.startsWith("5")) return "#7C3AED"; // 5xx — purple
    return "#DC2626";
  }
  // Indexable — shade by depth
  const greens = ["#16A34A","#22C55E","#4ADE80","#86EFAC","#BBF7D0"];
  return greens[Math.min(n.depth, greens.length - 1)];
}

function buildGraph(rawNodes) {
  if (!rawNodes?.length) return { nodes: [], links: [] };

  // Determine origin from first URL
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
        // Walk up path segments to find the closest stored parent
        for (let i = parts.length - 1; i >= 0; i--) {
          const candidate1 = `${u.origin}/${parts.slice(0, i).join("/")}`;
          const candidate2 = `${u.origin}/${parts.slice(0, i).join("/")}/`;
          if (i === 0) { parentId = origin; break; }
          if (urlSet.has(candidate1)) { parentId = candidate1; break; }
          if (urlSet.has(candidate2)) { parentId = candidate2; break; }
        }
      }
    } catch { /* keep origin as parent */ }

    if (parentId !== n.url) links.push({ source: parentId, target: n.url });
  });

  return { nodes: gNodes, links };
}

// ── Legend ─────────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { color: "#16A34A", label: "Indexable (depth 0)" },
    { color: "#4ADE80", label: "Indexable (depth 2)" },
    { color: "#86EFAC", label: "Indexable (depth 3+)" },
    { color: "#F59E0B", label: "Redirect (3xx)" },
    { color: "#DC2626", label: "Error / Non-indexable" },
    { color: "#7C3AED", label: "Server Error (5xx)" },
  ];
  return (
    <div style={{ position: "absolute", bottom: 24, left: 24, background: "rgba(0,0,0,.65)", borderRadius: 8, padding: "12px 16px", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,.12)" }}>
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
  const indexable = nodes.filter(n => n.index).length;
  const nonIndexable = nodes.filter(n => !n.index).length;
  const avgDepth = nodes.length ? (nodes.reduce((s, n) => s + n.depth, 0) / nodes.length).toFixed(1) : 0;
  const orphans = nodes.filter(n => n.inlinks === 0 && n.depth > 0).length;
  const stats = [
    { label: "Total URLs", value: nodes.length.toLocaleString() },
    { label: "Indexable",  value: indexable.toLocaleString(), color: "#4ADE80" },
    { label: "Non-indexable", value: nonIndexable.toLocaleString(), color: "#FCA5A5" },
    { label: "Avg Depth",  value: avgDepth },
    { label: "Orphaned",   value: orphans.toLocaleString(), color: "#FCD34D" },
  ];
  return (
    <div style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 2, background: "rgba(0,0,0,.65)", borderRadius: 8, padding: "8px 16px", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,.12)" }}>
      {stats.map(({ label, value, color }, i) => (
        <div key={label} style={{ textAlign: "center", padding: "0 14px", borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,.12)" : "none" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: color || "#F9FAFB", fontFamily: "'Inter',sans-serif" }}>{value}</div>
          <div style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "'Inter',sans-serif", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
function Tooltip({ node, pos }) {
  if (!node) return null;
  const isRoot = node.depth === 0 && !node.index === false && node.url === node.id;
  return (
    <div style={{
      position: "fixed", left: pos.x + 16, top: pos.y - 8,
      background: nodeColor(node), borderRadius: 8, padding: "10px 14px",
      maxWidth: 320, pointerEvents: "none", zIndex: 9999,
      boxShadow: "0 4px 20px rgba(0,0,0,.4)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", wordBreak: "break-all", marginBottom: node.title ? 4 : 0, fontFamily: "'Inter',sans-serif" }}>{node.url}</div>
      {node.title && <div style={{ fontSize: 10, color: "rgba(255,255,255,.85)", marginBottom: 6, fontFamily: "'Inter',sans-serif" }}>{node.title}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
        {[
          ["Status",   node.status],
          ["Depth",    node.depth],
          ["Inlinks",  node.inlinks],
          node.index !== undefined && ["Indexable", node.index ? "Yes" : "No"],
        ].filter(Boolean).map(([k, v]) => (
          <span key={k} style={{ fontSize: 10, color: "rgba(255,255,255,.9)", fontFamily: "'Inter',sans-serif" }}>
            <b>{k}:</b> {v}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────
export default function DirectoryTreeModal({ nodes: rawNodes, onClose }) {
  const mountRef = useRef(null);
  const graphRef = useRef(null);
  const [tooltip, setTooltip] = useState({ node: null, pos: { x: 0, y: 0 } });
  const [ready, setReady] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);

  useEffect(() => {
    let fg;
    let cancelled = false;

    (async () => {
      const { default: ForceGraph3D } = await import("3d-force-graph");
      if (cancelled || !mountRef.current) return;

      const graphData = buildGraph(rawNodes);
      setNodeCount(graphData.nodes.filter(n => n.depth !== undefined).length);

      fg = ForceGraph3D({ antialias: true, alpha: false })(mountRef.current)
        .width(mountRef.current.clientWidth)
        .height(mountRef.current.clientHeight)
        .backgroundColor("#1a1a2e")
        .graphData(graphData)
        .nodeLabel(() => "") // we use custom tooltip
        .nodeColor(n => nodeColor(n))
        .nodeOpacity(0.92)
        .nodeVal(n => Math.max(1, (n.inlinks || 0) * 0.4 + 1.5))
        .linkColor(() => "rgba(255,255,255,0.15)")
        .linkWidth(0.4)
        .linkOpacity(0.6)
        .onNodeHover((node, evt) => {
          if (!node) { setTooltip({ node: null, pos: { x: 0, y: 0 } }); return; }
          const e = evt || window.event;
          setTooltip({ node, pos: { x: e?.clientX ?? 0, y: e?.clientY ?? 0 } });
          mountRef.current.style.cursor = node ? "pointer" : "default";
        })
        .onNodeClick(node => {
          if (node.url && node.url !== node.id) window.open(node.url, "_blank");
        });

      // Warm-up: zoom to fit after physics settle
      setTimeout(() => {
        if (!cancelled) { fg.zoomToFit(800, 80); setReady(true); }
      }, 2500);

      graphRef.current = fg;
    })();

    const handleResize = () => {
      if (graphRef.current && mountRef.current) {
        graphRef.current.width(mountRef.current.clientWidth).height(mountRef.current.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
      if (graphRef.current) {
        try { graphRef.current._destructor?.(); } catch {}
        graphRef.current = null;
      }
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
        <button
          onClick={() => graphRef.current?.zoomToFit(600, 80)}
          style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", color: "#D1D5DB", padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}
        >
          Zoom to Fit
        </button>
        <button
          onClick={onClose}
          style={{ background: "rgba(220,38,38,.15)", border: "1px solid rgba(220,38,38,.3)", color: "#FCA5A5", padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}
        >
          ✕ Close
        </button>
      </div>

      {/* Stats bar */}
      <StatsBar nodes={rawNodes} />

      {/* Graph container */}
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* Loading overlay */}
      {!ready && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
          <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,.1)", borderTopColor: "#4ADE80", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 16 }} />
          <div style={{ color: "#9CA3AF", fontSize: 12 }}>Building graph…</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Legend */}
      <Legend />

      {/* Tooltip */}
      <Tooltip node={tooltip.node} pos={tooltip.pos} />

      {/* Instructions */}
      <div style={{ position: "absolute", bottom: 24, right: 24, fontSize: 10, color: "#4B5563", textAlign: "right", lineHeight: 1.8 }}>
        Left-click + drag · Scroll to zoom · Right-click to pan
      </div>
    </div>
  );
}
