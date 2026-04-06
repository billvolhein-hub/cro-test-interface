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

export async function getTopBacklinks(target) {
  return ahrefs("backlinks", {
    target:   stripProtocol(target),
    mode:     "domain",
    select:   "url_from,url_to,domain_from,dofollow,anchor",
    limit:    "1000",
    order_by: "ahrefs_rank_source:desc",
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

export async function getSerpFeaturesHistory(target) {
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().split("T")[0]);
  }
  function norm(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(f => typeof f === "string" ? f.toLowerCase().replace(/ /g, "_") : String(f));
    if (typeof raw === "string") return raw.split(",").map(f => f.trim().toLowerCase().replace(/ /g, "_"));
    return [];
  }
  return Promise.all(
    months.map(date =>
      ahrefs("organic-keywords", {
        target:   stripProtocol(target),
        mode:     "domain",
        date,
        select:   "keyword,serp_features,volume",
        limit:    "500",
        order_by: "volume:desc",
      }).then(data => {
        const keywords = data?.keywords ?? [];
        const features = {};
        keywords.forEach(kw => norm(kw.serp_features).forEach(f => { features[f] = (features[f] || 0) + 1; }));
        return {
          date,
          label: new Date(date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
          features,
          total: keywords.length,
        };
      }).catch(() => ({
        date,
        label: new Date(date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
        features: {},
        total: 0,
      }))
    )
  );
}

export async function getOrganicCompetitors(target) {
  return ahrefs("organic-competitors", {
    target:   stripProtocol(target),
    mode:     "domain",
    limit:    "20",
    order_by: "common_keywords:desc",
  });
}

export async function getOrganicKeywords(target) {
  return ahrefs("organic-keywords", {
    target:   stripProtocol(target),
    mode:     "domain",
    date:     today(),
    select:   "keyword,best_position,best_position_kind,volume,sum_traffic,best_position_url,serp_features,cpc,keyword_difficulty,is_branded,is_commercial,is_informational,is_transactional,is_navigational,is_local",
    limit:    "1000",
    order_by: "sum_traffic:desc",
  });
}
