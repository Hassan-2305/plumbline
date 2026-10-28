import type {
  ContentItem,
  ContentStatus,
  ContentType,
  DismissReason,
  Finding,
  FindingCategory,
  FindingStatus,
  Juror,
  Severity,
} from "../types";
import { NORTHSTAR } from "./brand";
import { noFactEvidence, ruleEvidence } from "../engine/evidence";

// SEEDED DEMO HISTORY — fictional review decisions so Insights has something to
// show on first run. Every item is flagged `seeded: true` and labelled in the UI.

const SEEDED_BY = "Seeded demo reviewer";

interface Spec {
  juror: Juror;
  severity: Severity;
  category: FindingCategory;
  title: string;
  offending: string;
  rules: string[];
  status: FindingStatus;
  reason?: DismissReason;
  note?: string;
  noFact?: boolean;
}

function finding(itemIdx: number, n: number, at: string, s: Spec): Finding {
  const evidence = [
    ...(s.noFact ? [noFactEvidence("Seeded example.")] : []),
    ...s.rules.map((id) => ruleEvidence(NORTHSTAR.rules.find((r) => r.id === id)!)),
  ];
  const history: Finding["history"] = [{ action: "created", at, by: "Deterministic checks" }];
  if (s.status !== "open") {
    history.push({
      action: s.status === "edited" ? "edited" : s.status,
      at,
      by: SEEDED_BY,
      reason: s.reason,
      note: s.note,
    } as Finding["history"][number]);
  }
  return {
    id: `finding-${String(n).padStart(3, "0")}`,
    juror: s.juror,
    severity: s.severity,
    category: s.category,
    title: s.title,
    offendingText: s.offending,
    explanation: "Seeded demo finding.",
    evidence,
    suggestedFix: "—",
    confidence: null,
    status: s.status,
    source: "deterministic",
    verification: "verified",
    ruleIds: s.rules,
    history,
  };
}

const TONE = (status: FindingStatus, reason?: DismissReason, note?: string): Spec => ({
  juror: "Brand Guardian",
  severity: "low",
  category: "guideline_conflict",
  title: "Tone sits between R-001 and R-009",
  offending: "You'll love it.",
  rules: ["R-001", "R-009"],
  status,
  reason,
  note,
});

const DATA: {
  title: string;
  type: ContentType;
  status: ContentStatus;
  date: string;
  /** Text before fixes were accepted (version 1), when it differs from the final text. */
  original?: string;
  text: string;
  specs: Spec[];
}[] = [
  {
    title: "Spring launch teaser",
    type: "Social post",
    status: "approved",
    date: "2026-10-06T10:12:00.000Z",
    original: "Spring is here! You'll love our new chocolate recipe, made with 24g of plant protein per serving.",
    text: "Spring is here! You'll love our new chocolate recipe, made with 24g of plant-based protein per serving.",
    specs: [
      TONE("dismissed", "Rule unclear", "R-001 says conversational, R-009 says formal. Went with R-001."),
      { juror: "Brand Guardian", severity: "low", category: "preferred_term", title: 'Use "plant-based protein"', offending: "plant protein", rules: ["R-003"], status: "accepted" },
    ],
  },
  {
    title: "Gym partnership email",
    type: "Marketing email",
    status: "approved",
    date: "2026-10-09T14:40:00.000Z",
    text: "We're proud to partner with the best local gyms! Northstar Daily Protein contains no artificial sweeteners.",
    specs: [
      TONE("dismissed", "Rule unclear", "Partner emails are meant to be friendly."),
      { juror: "Risk & Compliance", severity: "medium", category: "superlative", title: 'Unsubstantiated superlative "best"', offending: "best", rules: ["R-002"], status: "dismissed", reason: "Approved exception", note: "Quoted partner testimonial, legal signed off.", noFact: true },
    ],
  },
  {
    title: "Recipe blog intro",
    type: "Web copy",
    status: "changes_requested",
    date: "2026-10-13T09:05:00.000Z",
    original:
      "Let's get blending! This smoothie boosts immunity and tastes great, and it is the kind of recipe that you can make in a few minutes before work with whatever fruit you happen to have in the kitchen this week.",
    text: "Let's get blending! This smoothie boosts immunity and tastes great. Make it before work with whatever fruit you have.",
    specs: [
      TONE("dismissed", "Rule unclear", "Blog voice is casual by design."),
      { juror: "Risk & Compliance", severity: "high", category: "clinical_claim", title: "Unsupported clinical claim", offending: "boosts immunity", rules: ["R-005"], status: "escalated", note: "Needs regulatory review.", noFact: true },
      { juror: "Accessibility Advocate", severity: "low", category: "readability", title: "Long sentence", offending: "This smoothie…", rules: ["R-008"], status: "accepted" },
    ],
  },
  {
    title: "Retail shelf ad",
    type: "Ad copy",
    status: "under_review",
    date: "2026-10-19T16:20:00.000Z",
    original: "Northstar Daily Protein. The ultimate miracle formula, made from pea and brown rice protein.",
    text: "Northstar Daily Protein. The ultimate plant-based formula, made from pea and brown rice protein.",
    specs: [
      { juror: "Risk & Compliance", severity: "medium", category: "superlative", title: 'Unsubstantiated superlative "ultimate"', offending: "ultimate", rules: ["R-002"], status: "dismissed", reason: "False positive", note: "Used as a product line name.", noFact: true },
      { juror: "Brand Guardian", severity: "high", category: "banned_term", title: 'Banned phrase "miracle formula"', offending: "miracle formula", rules: ["R-004"], status: "accepted" },
    ],
  },
  {
    title: "Customer FAQ answer",
    type: "Web copy",
    status: "approved",
    date: "2026-10-22T11:30:00.000Z",
    original: "It's simple: each serving of Northstar Daily Protein contains 30g of plant-based protein. You'll find the full panel on the pack, and it's the best value tub we make.",
    text: "It's simple: each serving of Northstar Daily Protein contains 24g of plant-based protein. You'll find the full panel on the pack, and it's the best value tub we make.",
    specs: [
      TONE("dismissed", "Rule unclear", "FAQ should be approachable — unclear which tone rule wins."),
      { juror: "Fact-Checker", severity: "high", category: "contradicts_fact", title: '"30g" may contradict F-001', offending: "30g", rules: ["R-006"], status: "accepted" },
      { juror: "Risk & Compliance", severity: "medium", category: "superlative", title: 'Unsubstantiated superlative "best"', offending: "best", rules: ["R-002"], status: "dismissed", reason: "Rule unclear", note: "Is 'best value' a superlative under R-002?", noFact: true },
    ],
  },
];

export function seededHistory(): ContentItem[] {
  return DATA.map((d, i) => {
    const findings = d.specs.map((s, k) => finding(i, k + 1, d.date, s));
    const approved = d.status === "approved";
    return {
      id: `seed-${i + 1}`,
      title: d.title,
      brandId: NORTHSTAR.id,
      contentType: d.type,
      status: d.status,
      text: d.text,
      meta: { hasImage: false, altText: "", fg: "", bg: "" },
      versions: d.original
        ? [
            { id: `seed-${i + 1}-v1`, number: 1, text: d.original, createdAt: d.date, label: "Seeded original" },
            { id: `seed-${i + 1}-v2`, number: 2, text: d.text, createdAt: d.date, label: "Seeded final text (fixes accepted)" },
          ]
        : [{ id: `seed-${i + 1}-v1`, number: 1, text: d.text, createdAt: d.date, label: "Seeded final text" }],
      findings,
      matchedFacts: [],
      runs: [{ id: `seed-run-${i + 1}`, at: d.date, mode: "seeded", aiStatus: "seeded", versionNumber: d.original ? 2 : 1, findingCount: findings.length }],
      approvals: approved || d.status === "changes_requested"
        ? [{
            decision: approved ? "approved" : "changes_requested",
            at: d.date,
            reviewer: SEEDED_BY,
            versionNumber: d.original ? 2 : 1,
            overriddenFindingIds: [],
            note: approved ? "Seeded approval." : "Escalated clinical claim must be resolved.",
          }]
        : [],
      events: [{ at: d.date, by: SEEDED_BY, text: "Seeded demo history item created." }],
      seeded: true,
      createdAt: d.date,
      updatedAt: d.date,
    };
  });
}
