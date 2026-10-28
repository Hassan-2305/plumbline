import type { Brand } from "../types";

// FICTIONAL DEMO DATA. Northstar Nutrition is not a real company. None of these
// facts are real-world substantiation, clinical evidence or regulatory approval.

const SEED_DATE = "2026-10-01T09:00:00.000Z";

function rule(id: string, title: string, text: string) {
  return { id, title, text, version: 1, history: [] as Brand["rules"][number]["history"] };
}

export const NORTHSTAR: Brand = {
  id: "northstar",
  name: "Northstar Nutrition",
  description:
    "Fictional plant-based protein company used as demo data. Not a real brand.",
  fictional: true,
  rules: [
    rule("R-001", "Brand voice", "Brand voice should be clear, confident, conversational, and science-led."),
    rule("R-002", "No sensationalism", "Avoid sensationalist language and unsupported superlatives."),
    rule("R-003", "Preferred terminology", 'Prefer terminology "plant-based protein".'),
    rule("R-004", "Banned phrase", 'Ban phrase "miracle formula".'),
    rule("R-005", "Health claims", "Clinical and health claims require approved supporting evidence."),
    rule("R-006", "Numerical claims", "Numerical product claims must match approved facts."),
    rule("R-007", "Fact expiry", "Expired facts cannot support current promotional claims."),
    rule("R-008", "Accessibility", "Customer-facing content must meet applicable accessibility requirements."),
    rule("R-009", "Formal tone", "Customer-facing copy must maintain a formal, authoritative tone."),
    rule("R-010", "Visual identity", "Use approved logos and brand colours."),
  ],
  facts: [
    {
      id: "F-001",
      statement: "Each serving of Northstar Daily Protein contains 24g of plant-based protein.",
      source: "Fictional demo: product specification sheet v3 (internal)",
      lastVerified: "2026-08-14",
      expires: "2027-08-14",
      status: "approved",
      signals: ["24g"],
    },
    {
      id: "F-002",
      statement: "Northstar Daily Protein is made from a blend of pea and brown rice protein.",
      source: "Fictional demo: formulation record FR-12 (internal)",
      lastVerified: "2026-06-02",
      status: "approved",
      signals: ["pea and brown rice"],
    },
    {
      id: "F-003",
      statement: "Northstar Daily Protein contains no artificial sweeteners.",
      source: "Fictional demo: ingredient declaration (internal)",
      lastVerified: "2026-06-02",
      status: "approved",
      signals: ["no artificial sweeteners"],
    },
    {
      id: "F-004",
      statement:
        "In an internal 2026 taste panel of 120 participants, 78% preferred the new chocolate recipe over the previous recipe.",
      source: "Fictional demo: internal taste panel summary, March 2026",
      lastVerified: "2026-03-20",
      expires: "2027-03-20",
      status: "approved",
      signals: ["78%"],
    },
    {
      id: "F-005",
      statement: "Northstar Daily Protein contains 5g of fibre per serving.",
      source: "Fictional demo: nutrition panel draft (awaiting sign-off)",
      lastVerified: "2026-09-30",
      status: "pending",
      signals: ["5g"],
    },
    {
      id: "F-006",
      statement: "Rated 4.8 out of 5 by more than 2,000 verified customers.",
      source: "Fictional demo: 2024 review-platform export",
      lastVerified: "2024-11-30",
      expires: "2025-12-31",
      status: "approved",
      signals: ["4.8", "2,000"],
    },
  ],
  bannedTerms: [
    { term: "miracle formula", ruleId: "R-004", replacement: "plant-based formula" },
  ],
  preferredTerms: [
    {
      avoid: ["vegan protein", "veggie protein", "plant protein", "plant-powered protein"],
      prefer: "plant-based protein",
      ruleId: "R-003",
    },
  ],
  safeBenefit: { factId: "F-002", phrase: "made from a blend of pea and brown rice protein" },
  ruleRoles: { sensational: "R-002", health: "R-005", numbers: "R-006", expiry: "R-007", accessibility: "R-008", visual: "R-010" },
  sensitiveTerms: ["Project Polaris"],
  changes: [],
  changelog: [],
  palette: [
    { name: "Charcoal", hex: "#1C1C1E" },
    { name: "White", hex: "#FFFFFF" },
    { name: "Northstar Green", hex: "#2F6B4F" },
    { name: "Oat", hex: "#F4EFE6" },
    { name: "Signal Orange", hex: "#C2410C" },
  ],
};

export { SEED_DATE };
