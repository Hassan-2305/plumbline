import type { ContentMeta, ContentType, DraftFinding } from "../types";
import { NORTHSTAR } from "./brand";
import { factEvidence, noFactEvidence, ruleEvidence } from "../engine/evidence";

// One-click demo scenarios (fictional). `seededJury` findings are PRECOMPUTED
// examples of what the AI jurors produce — always labelled "Seeded demo result",
// never presented as a live AI call.

export interface Example {
  id: "A" | "B" | "C";
  title: string;
  contentType: ContentType;
  blurb: string;
  text: string;
  meta: ContentMeta;
  seededJury: DraftFinding[];
}

const r = (id: string) => ruleEvidence(NORTHSTAR.rules.find((x) => x.id === id)!);
const f = (id: string) => factEvidence(NORTHSTAR.facts.find((x) => x.id === id)!);

export const EXAMPLES: Example[] = [
  {
    id: "A",
    title: "Launch social post",
    contentType: "Social post",
    blurb: "Banned phrase, a number that contradicts an approved fact, and an unsupported clinical claim.",
    text:
      "Meet the Northstar miracle formula. Each scoop packs 40g of protein and is clinically proven to double your results. Athletes see 50% faster recovery in just two weeks. #PlantPowered",
    meta: { hasImage: false, altText: "", fg: "", bg: "" },
    seededJury: [
      {
        juror: "Risk & Compliance",
        severity: "medium",
        category: "misleading_claim",
        title: "Implied athletic performance outcome",
        offendingText: "Athletes see 50% faster recovery in just two weeks",
        explanation:
          "Attributes a specific recovery outcome to the product for a defined group and timeframe. No approved fact covers recovery, so readers may take this as a substantiated health claim.",
        evidence: [noFactEvidence("No fact mentions recovery or athletes."), r("R-005")],
        suggestedFix: "Remove the outcome claim or replace it with an approved product fact.",
        replacement: "It contains no artificial sweeteners",
        confidence: 0.82,
        source: "seeded",
        verification: "verified",
        ruleIds: ["R-005"],
      },
      {
        juror: "Brand Guardian",
        severity: "low",
        category: "tone",
        title: "Hype-led voice rather than science-led",
        offendingText: "Meet the Northstar miracle formula",
        explanation:
          "The opening leans on hype rather than the clear, science-led voice described in R-001, and overlaps with the banned phrase in R-004.",
        evidence: [r("R-001"), r("R-004")],
        suggestedFix: "Lead with a concrete, approved product fact.",
        confidence: 0.7,
        source: "seeded",
        verification: "verified",
        ruleIds: ["R-001", "R-004"],
      },
    ],
  },
  {
    id: "B",
    title: "Welcome email",
    contentType: "Marketing email",
    blurb: "Preferred-term violations and a rating that relies on an expired fact.",
    text:
      "Subject: Your new favourite vegan protein\n\nHi there,\n\nNorthstar Daily Protein is made from a blend of pea and brown rice protein, with 24g of plant protein in every serving. Rated 4.8 out of 5 by more than 2,000 verified customers, it is the shake our community keeps coming back to.\n\nOrder this week and get free delivery. Questions? Email hello@northstar-nutrition.example. P.S. Project Polaris is coming this spring.\n\nThe Northstar team",
    meta: { hasImage: false, altText: "", fg: "", bg: "" },
    seededJury: [
      {
        juror: "Fact-Checker",
        severity: "low",
        category: "messaging",
        title: "Rating presented as current",
        offendingText: "it is the shake our community keeps coming back to",
        explanation:
          "Repeat-purchase behaviour is implied but not covered by any approved fact. It reads as opinion, so it is low risk, but it leans on the lapsed rating in the previous clause.",
        evidence: [noFactEvidence("No fact covers repeat purchase."), r("R-006"), f("F-006")],
        suggestedFix: "Keep as brand voice only if the expired rating is removed.",
        confidence: 0.55,
        source: "seeded",
        verification: "verified",
        ruleIds: ["R-006"],
      },
    ],
  },
  {
    id: "C",
    title: "Homepage hero (mostly compliant)",
    contentType: "Web copy",
    blurb: "Uses approved facts correctly but raises the R-001 / R-009 tone conflict and fails contrast.",
    text:
      "You'll find 24g of plant-based protein in every serving of Northstar Daily Protein, with no artificial sweeteners. Let's make your morning shake simple: blend, sip, go!",
    meta: { hasImage: true, altText: "", fg: "#F5A25D", bg: "#FFFFFF" },
    seededJury: [
      {
        juror: "Accessibility Advocate",
        severity: "low",
        category: "accessibility",
        title: "Instructional fragment may be ambiguous",
        offendingText: "blend, sip, go!",
        explanation:
          "Short imperative fragments can be unclear when read aloud out of visual context. This is a judgement call based on the text only; no screen reader was tested.",
        evidence: [r("R-008")],
        suggestedFix: "Consider a complete sentence, e.g. \"Blend it, sip it and get on with your day.\"",
        confidence: 0.45,
        source: "seeded",
        verification: "verified",
        ruleIds: ["R-008"],
      },
    ],
  },
];
