export const TEST_STATUSES = [
  { value: "Backlog",           color: "#1B3A6B", bg: "#EEF2FF", border: "#C7D2FE" },
  { value: "Under Review",      color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  { value: "Promoted to Test",  color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE" },
  { value: "Test Running",      color: "#0E7490", bg: "#ECFEFF", border: "#A5F3FC" },
  { value: "Test Complete",     color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0" },
];

export const DEFAULT_STATUS = "Backlog";

export const TEST_TYPES = ["A/B", "A/B/n", "Multivariate", "Split URL", "Redirect"];

export const METRICS = [
  "Form submissions", "RFI completions", "CTA clicks", "Scroll depth",
  "Time on page", "Bounce rate", "Sessions", "Conversion rate",
  "Engagement rate", "Exit rate",
];

export const AUDIENCES = [
  "All users", "New users", "Returning users", "Organic search",
  "Paid search", "Mobile users", "Desktop users", "Direct traffic",
];

export const PIE_CRITERIA = [
  {
    key: "potential", label: "Potential", color: "#C9A84C", bg: "#FDFBF3", border: "#EFE0A8",
    description: "How much improvement can this test realistically deliver?",
    hints: [
      "1–2: Marginal uplift expected, page already well-optimized",
      "3–5: Moderate improvement possible, some clear friction points",
      "6–8: Significant gains likely, known conversion barriers present",
      "9–10: High-impact opportunity, strong evidence of friction or drop-off",
    ],
  },
  {
    key: "importance", label: "Importance", color: "#1B3A6B", bg: "#F0F4FA", border: "#C0CFEA",
    description: "How much traffic and strategic value does this page carry?",
    hints: [
      "1–2: Low-traffic or low-priority page",
      "3–5: Moderate traffic, secondary program or audience",
      "6–8: High-traffic page, meaningful conversion volume",
      "9–10: Core acquisition page, top program, significant business impact",
    ],
  },
  {
    key: "ease", label: "Ease", color: "#2A8C8C", bg: "#F0FAFA", border: "#A8D8D8",
    description: "How easy is it to design, build, and launch this test?",
    hints: [
      "1–2: Complex dev work, stakeholder dependencies, or technical risk",
      "3–5: Moderate effort, some design or dev required",
      "6–8: Straightforward change, limited dev involvement",
      "9–10: Simple copy or layout swap, can be done in Convert quickly",
    ],
  },
];

export const OVERLAY_TYPES = [
  { label: "Add/Blur",      color: "#4A90D9" },
  { label: "Removed",       color: "#E74C3C" },
  { label: "Copy Change",   color: "#2ECC71" },
  { label: "Layout Shift",  color: "#9B59B6" },
  { label: "Sticky Element",color: "#F39C12" },
  { label: "CTA Highlight", color: "#1ABC9C" },
  { label: "Brand Accent",  color: "#E91E63" },
  { label: "Annotation",    color: "#F59E0B", isAnnotation: true },
];

export const SCREENSHOT_ZONES = [
  { key: "controlDesktop",  label: "Control",   sub: "Desktop" },
  { key: "controlMobile",   label: "Control",   sub: "Mobile"  },
  { key: "variantDesktop",  label: "Variant B", sub: "Desktop" },
  { key: "variantMobile",   label: "Variant B", sub: "Mobile"  },
];

// ── Colors ────────────────────────────────────────────────────────────────────
export const ACCENT      = "#1B3A6B";
export const TEAL        = "#2A8C8C";
export const GOLD        = "#C9A84C";
export const BG          = "#F7F8FA";
export const CARD        = "#FFFFFF";
export const BORDER      = "#DDE3ED";
export const TEXT        = "#0F1923";
export const MUTED       = "#4A5568";
export const DIM         = "#C4CDD8";
export const IF_COLOR    = "#1B3A6B";
export const THEN_COLOR  = "#2A8C8C";
export const BECAUSE_COLOR = "#C9A84C";

// ── Clients ───────────────────────────────────────────────────────────────────
export const CLIENTS_LS_KEY = "hypothesis-builder-clients";

export const SEED_CLIENT = { id: 1, name: "CSU Global", createdAt: 0 };

// ── Seed data ─────────────────────────────────────────────────────────────────
export const SEED_TEST = {
  id: 1,
  clientId: 1,
  status: "Backlog",
  testName: "High-Traffic Article Conversion",
  pageUrl: "https://csuglobal.edu/blog/how-does-ai-actually-work",
  testType: "A/B",
  audience: "New users",
  primaryMetric: "CTA clicks",
  secondaryMetrics: ["Form submissions"],
  if: "we add an inline RFI CTA immediately after the first main H2 heading on long-form blog articles",
  then: "CTA engagement and program form submissions will increase among new users",
  because: "readers who reach the first H2 have demonstrated content engagement and are at a high-attention moment — a contextual in-flow CTA reduces friction compared to relying on persistent or footer placements alone",
  potential: 6,
  importance: 6,
  ease: 6,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
