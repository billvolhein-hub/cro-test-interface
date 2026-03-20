const today   = () => new Date().toISOString().split("T")[0];
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().split("T")[0];

function stripProtocol(url) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0];
}

async function ahrefs(endpoint, params = {}) {
  const qs = new URLSearchParams({ endpoint, ...params }).toString();
  const res = await fetch(`/api/ahrefs?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}

export async function getDomainRating(target) {
  const data = await ahrefs("domain-rating", { target: stripProtocol(target), date: today() });
  // API returns { domain_rating: { domain_rating: N, ahrefs_rank: N } } — unwrap inner object
  const inner = data?.domain_rating;
  return (inner && typeof inner === "object") ? inner : data;
}

export async function getDomainRatingHistory(target) {
  return ahrefs("domain-rating-history", {
    target:           stripProtocol(target),
    date_from:        daysAgo(365 * 3),
    date_to:          today(),
    history_grouping: "monthly",
  });
}

export async function getMetricsExtended(target) {
  return ahrefs("backlinks-stats", { target: stripProtocol(target), mode: "domain", date: today() });
}

export async function getBacklinksHistory(target) {
  // Build the 1st of each month for the past 12 months
  const dates = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  const results = await Promise.all(
    dates.map(date =>
      ahrefs("backlinks-stats", { target: stripProtocol(target), mode: "domain", date })
        .then(raw => {
          const m = raw?.stats ?? raw?.metrics ?? raw ?? {};
          return {
            date,
            label:      new Date(date).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
            backlinks:  m.live          ?? 0,
            refdomains: m.live_refdomains ?? 0,
          };
        })
        .catch(() => ({ date, label: date.slice(0, 7), backlinks: 0, refdomains: 0 }))
    )
  );
  return results;
}

export async function getRefdomains(target) {
  // Fetch without DR ordering so we get a representative cross-section for the histogram.
  // Sorted by links_to_target (most-linking domains first) which is more useful for display.
  return ahrefs("refdomains", {
    target:   stripProtocol(target),
    mode:     "domain",
    select:   "domain,domain_rating,links_to_target,dofollow_links,first_seen",
    limit:    "5000",
    order_by: "links_to_target:desc",
  });
}

export async function getAnchors(target) {
  return ahrefs("anchors", {
    target:   stripProtocol(target),
    mode:     "domain",
    select:   "anchor,links_to_target,refpages,refdomains",
    limit:    "50",
    order_by: "links_to_target:desc",
  });
}

export async function getBacklinksNewLost(target) {
  return ahrefs("refdomains-history", {
    target:           stripProtocol(target),
    mode:             "domain",
    date_from:        daysAgo(90),
    date_to:          today(),
    history_grouping: "weekly",
  });
}
