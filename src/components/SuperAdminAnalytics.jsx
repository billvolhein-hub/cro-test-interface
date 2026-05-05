import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { fetchAgencies } from "../lib/agencies";
import { fetchClients, fetchTests } from "../lib/api";
import { BG, BORDER, CARD, MUTED, TEXT, ACCENT, TEAL, GOLD, TEST_STATUSES } from "../lib/constants";

const STATUS_COLORS = Object.fromEntries(TEST_STATUSES.map(s => [s.value, s.color]));
const PIE_PALETTE = ["#1B3A6B", "#2A8C8C", "#C9A84C", "#7C3AED", "#DC2626", "#15803D"];
const TYPE_PALETTE = ["#1B3A6B", "#2A8C8C", "#C9A84C", "#7C3AED", "#DC2626"];

// ── Velocity bucket builder ────────────────────────────────────────────────────
function buildVelocityData(tests, range) {
  const now = Date.now();
  const buckets = [];

  if (range === "7d") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400_000);
      buckets.push({
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        start: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
        end:   new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime(),
      });
    }
  } else if (range === "30d") {
    for (let i = 3; i >= 0; i--) {
      const start = now - (i + 1) * 7 * 86400_000;
      const end   = now - i * 7 * 86400_000;
      const d = new Date(start);
      buckets.push({ label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), start, end });
    }
  } else if (range === "90d") {
    for (let i = 12; i >= 0; i--) {
      const start = now - (i + 1) * 7 * 86400_000;
      const end   = now - i * 7 * 86400_000;
      const d = new Date(start);
      buckets.push({ label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), start, end });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      const start = d.getTime();
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      buckets.push({ label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), start, end });
    }
  }

  return buckets.map(b => ({
    name:  b.label,
    Tests: tests.filter(t => t.createdAt >= b.start && t.createdAt <= b.end).length,
  }));
}

// ── Small shared sub-components ───────────────────────────────────────────────
function KpiCard({ label, value, sub, color = TEXT }) {
  return (
    <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: "18px 20px", flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children, style }) {
  return (
    <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: "20px 20px 12px", ...style }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0F172A", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
      {label && <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color ?? "#E2E8F0" }}>{p.name}: <b>{p.value}</b></div>
      ))}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function SuperAdminAnalytics() {
  const [open,     setOpen]     = useState(true);
  const [range,    setRange]    = useState("30d");
  const [agencies, setAgencies] = useState([]);
  const [clients,  setClients]  = useState([]);
  const [tests,    setTests]    = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([fetchAgencies(), fetchClients(), fetchTests()])
      .then(([a, c, t]) => { setAgencies(a); setClients(c); setTests(t); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Derived stats ────────────────────────────────────────────────────────────
  const cutoff = useMemo(() => {
    if (range === "All") return 0;
    const days = { "7d": 7, "30d": 30, "90d": 90 }[range];
    return Date.now() - days * 86400_000;
  }, [range]);

  const rangedTests = useMemo(() => tests.filter(t => t.createdAt >= cutoff), [tests, cutoff]);

  const liveCount = useMemo(() => tests.filter(t => t.status === "Test Running").length, [tests]);

  const avgPIE = useMemo(() => {
    if (!tests.length) return "—";
    const total = tests.reduce((s, t) => s + ((t.potential + t.importance + t.ease) / 3), 0);
    return (total / tests.length).toFixed(1);
  }, [tests]);

  const velocityData = useMemo(() => buildVelocityData(rangedTests, range), [rangedTests, range]);

  const pipelineData = useMemo(() => {
    const counts = {};
    tests.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tests]);

  const agencyTestData = useMemo(() => {
    return agencies.map(ag => {
      const agClients = clients.filter(c => c.agencyId === ag.id);
      const ids = new Set(agClients.map(c => c.id));
      return { name: ag.name.length > 16 ? ag.name.slice(0, 14) + "…" : ag.name, Tests: tests.filter(t => ids.has(t.clientId)).length };
    }).sort((a, b) => b.Tests - a.Tests);
  }, [agencies, clients, tests]);

  const agencyPIEData = useMemo(() => {
    return agencies.map(ag => {
      const agClients = clients.filter(c => c.agencyId === ag.id);
      const ids = new Set(agClients.map(c => c.id));
      const agTests = tests.filter(t => ids.has(t.clientId));
      if (!agTests.length) return null;
      const avg = k => parseFloat((agTests.reduce((s, t) => s + (t[k] ?? 5), 0) / agTests.length).toFixed(1));
      return {
        name: ag.name.length > 16 ? ag.name.slice(0, 14) + "…" : ag.name,
        Potential: avg("potential"),
        Importance: avg("importance"),
        Ease: avg("ease"),
      };
    }).filter(Boolean);
  }, [agencies, clients, tests]);

  const typeData = useMemo(() => {
    const map = {};
    rangedTests.forEach(t => {
      const type = t.testType || "Unknown";
      map[type] = (map[type] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rangedTests]);

  const seoClients     = useMemo(() => clients.filter(c => Object.keys(c.crawlReports).length > 0).length, [clients]);
  const portalClients  = useMemo(() => clients.filter(c => c.portalToken).length, [clients]);

  const recentActivity = useMemo(() => {
    return [...tests]
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
      .slice(0, 15)
      .map(t => {
        const client = clients.find(c => c.id === t.clientId);
        const agency = agencies.find(ag => ag.id === client?.agencyId);
        const ts = t.updatedAt || t.createdAt;
        const date = new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const status = TEST_STATUSES.find(s => s.value === t.status);
        return { ...t, clientName: client?.name ?? "—", agencyName: agency?.name ?? "—", date, statusMeta: status };
      });
  }, [tests, clients, agencies]);

  const rangeButtons = ["7d", "30d", "90d", "All"];

  if (loading) {
    return (
      <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: "32px 24px", textAlign: "center", color: MUTED, fontSize: 13 }}>
        Loading analytics…
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Section header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "14px 20px", background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: open ? "10px 10px 0 0" : 10, userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>📊</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Platform Analytics</span>
          <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>
            {agencies.length} {agencies.length === 1 ? "agency" : "agencies"} · {tests.length} tests total
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {open && (
            <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
              {rangeButtons.map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    padding: "4px 10px", borderRadius: 5, border: `1px solid ${range === r ? ACCENT : BORDER}`,
                    background: range === r ? ACCENT : "transparent",
                    color: range === r ? "#fff" : MUTED,
                    fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif",
                  }}>
                  {r}
                </button>
              ))}
            </div>
          )}
          <span style={{ fontSize: 12, color: MUTED, transform: open ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform .2s" }}>▼</span>
        </div>
      </div>

      {open && (
        <div style={{ border: `1.5px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 10px 10px", background: BG, padding: "20px 20px 24px" }}>

          {/* KPI Strip */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <KpiCard label="Agencies"     value={agencies.length} color={ACCENT} />
            <KpiCard label="Clients"      value={clients.length}  color={TEAL} />
            <KpiCard label="Total Tests"  value={tests.length}    color={TEXT} />
            <KpiCard label="Live Now"     value={liveCount}       color="#15803D" sub="Test Running status" />
            <KpiCard label="Avg PIE Score" value={avgPIE}         color={GOLD} sub="across all tests" />
          </div>

          {/* Row 1: Velocity + Pipeline */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, marginBottom: 16 }}>
            <ChartCard title={`Test Creation Velocity — ${range === "All" ? "All Time (monthly)" : range}`}>
              {rangedTests.length === 0 ? (
                <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 13 }}>No data in this range</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={velocityData} margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} width={28} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="Tests" stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3, fill: ACCENT }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Pipeline Status — All Time">
              {pipelineData.length === 0 ? (
                <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 13 }}>No tests yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pipelineData} dataKey="value" nameKey="name" cx="45%" cy="50%" outerRadius={80} innerRadius={44}>
                      {pipelineData.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.name] ?? PIE_PALETTE[i % PIE_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: TEXT }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Row 2: Agency Leaderboard + PIE by Agency */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <ChartCard title="Tests per Agency — All Time">
              {agencyTestData.length === 0 ? (
                <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 13 }}>No agencies yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, agencyTestData.length * 42)}>
                  <BarChart data={agencyTestData} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: TEXT, fontWeight: 600 }} tickLine={false} axisLine={false} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Tests" fill={ACCENT} radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Avg PIE by Agency — All Time">
              {agencyPIEData.length === 0 ? (
                <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 13 }}>No test data</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, agencyPIEData.length * 42)}>
                  <BarChart data={agencyPIEData} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                    <XAxis type="number" domain={[0, 10]} allowDecimals ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: TEXT, fontWeight: 600 }} tickLine={false} axisLine={false} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: TEXT }}>{v}</span>} />
                    <Bar dataKey="Potential"  fill={GOLD}  radius={[0, 2, 2, 0]} barSize={8} />
                    <Bar dataKey="Importance" fill={ACCENT} radius={[0, 2, 2, 0]} barSize={8} />
                    <Bar dataKey="Ease"       fill={TEAL}  radius={[0, 2, 2, 0]} barSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Row 3: Test Type + Platform Health + Recent Activity */}
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 1fr", gap: 16 }}>
            {/* Test Type Mix */}
            <ChartCard title={`Test Type Mix — ${range}`}>
              {typeData.length === 0 ? (
                <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 13 }}>No data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={36}>
                        {typeData.map((_, i) => <Cell key={i} fill={TYPE_PALETTE[i % TYPE_PALETTE.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                    {typeData.map((d, i) => (
                      <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_PALETTE[i % TYPE_PALETTE.length], flexShrink: 0 }} />
                        <span style={{ color: TEXT, fontWeight: 600 }}>{d.name}</span>
                        <span style={{ color: MUTED, marginLeft: "auto" }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </ChartCard>

            {/* Platform Health */}
            <ChartCard title="Platform Health — All Clients">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* SEO Coverage */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>SEO Coverage</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{seoClients} / {clients.length}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: BORDER, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: clients.length ? `${(seoClients / clients.length) * 100}%` : "0%", background: TEAL, borderRadius: 3, transition: "width .5s" }} />
                  </div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>clients with crawl report uploaded</div>
                </div>

                {/* Portal Adoption */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>Portal Adoption</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{portalClients} / {clients.length}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: BORDER, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: clients.length ? `${(portalClients / clients.length) * 100}%` : "0%", background: GOLD, borderRadius: 3, transition: "width .5s" }} />
                  </div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>clients with portal URL generated</div>
                </div>

                {/* Status breakdown */}
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 8 }}>Tests by Status</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {TEST_STATUSES.map(s => {
                      const count = tests.filter(t => t.status === s.value).length;
                      if (count === 0) return null;
                      return (
                        <div key={s.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                          <span style={{ color: TEXT, flex: 1 }}>{s.value}</span>
                          <span style={{ fontWeight: 700, color: s.color }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ChartCard>

            {/* Recent Activity */}
            <ChartCard title="Recent Activity">
              {recentActivity.length === 0 ? (
                <div style={{ color: MUTED, fontSize: 13, textAlign: "center", paddingTop: 40 }}>No tests yet</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0, maxHeight: 320, overflowY: "auto" }}>
                  {recentActivity.map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: t.statusMeta?.color ?? MUTED, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {t.testName || "Untitled Test"}
                        </div>
                        <div style={{ fontSize: 10, color: MUTED }}>{t.clientName} · {t.agencyName}</div>
                      </div>
                      <div style={{ fontSize: 10, color: MUTED, flexShrink: 0 }}>{t.date}</div>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </div>

        </div>
      )}
    </div>
  );
}
