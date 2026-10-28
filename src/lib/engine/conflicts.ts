import type { GuidelineConflict, Rule } from "../types";

// Lexicon-based conflict detection. It surfaces *potential* contradictions for a
// human to judge; it never resolves them itself.

const OPPOSING: { a: string[]; b: string[]; dimension: string }[] = [
  { a: ["conversational", "casual", "informal", "friendly", "playful"], b: ["formal", "strictly formal"], dimension: "tone register" },
  { a: ["concise", "short", "brief"], b: ["detailed", "comprehensive", "exhaustive"], dimension: "length" },
  { a: ["humorous", "witty", "fun"], b: ["serious", "solemn"], dimension: "mood" },
  { a: ["always use emoji", "use emoji"], b: ["no emoji", "avoid emoji"], dimension: "emoji use" },
];

function has(text: string, words: string[]) {
  const t = text.toLowerCase();
  return words.find((w) => new RegExp(`\\b${w}\\b`).test(t));
}

export interface DetectedConflict {
  ruleIds: [string, string];
  dimension: string;
  termA: string;
  termB: string;
}

export function detectConflicts(rules: Pick<Rule, "id" | "text">[]): DetectedConflict[] {
  const out: DetectedConflict[] = [];
  for (let i = 0; i < rules.length; i++) {
    for (let j = 0; j < rules.length; j++) {
      if (i === j) continue;
      for (const pair of OPPOSING) {
        const ta = has(rules[i].text, pair.a);
        const tb = has(rules[j].text, pair.b);
        if (ta && tb) {
          const ids = [rules[i].id, rules[j].id].sort() as [string, string];
          if (!out.some((c) => c.ruleIds[0] === ids[0] && c.ruleIds[1] === ids[1] && c.dimension === pair.dimension)) {
            out.push({ ruleIds: ids, dimension: pair.dimension, termA: ta, termB: tb });
          }
        }
      }
    }
  }
  return out;
}

/** Builds a reviewable conflict record. Clarification text is a proposal only. */
export function conflictFromDetection(d: DetectedConflict, rules: Rule[], brandId: string): GuidelineConflict {
  const [a, b] = d.ruleIds.map((id) => rules.find((r) => r.id === id)!);
  // Curated copy for the seeded Northstar demo conflict; generic wording otherwise.
  const known = brandId === "northstar" && d.ruleIds.join("|") === "R-001|R-009";
  return {
    id: `C-${brandId}-${d.ruleIds.join("-")}-${d.dimension.replace(/\s/g, "-")}`,
    brandId,
    ruleIds: d.ruleIds,
    why: known
      ? `R-001 asks for a "conversational" voice while R-009 requires a "formal, authoritative" tone for the same audience (customer-facing copy). A writer cannot satisfy both literally: contractions, direct address and informal phrasing comply with R-001 and breach R-009.`
      : `${a.id} uses "${d.termA}" and ${b.id} uses "${d.termB}" for ${d.dimension}. Both may apply to the same content, so a writer may be unable to satisfy both.`,
    exampleContext: known
      ? `A social post saying "You'll love how easy it is to hit your protein goals" follows R-001 but would be flagged under R-009. Reviewers have dismissed R-009 tone findings as "Rule unclear" in seeded history.`
      : `Any content governed by both ${a.id} and ${b.id}.`,
    proposedRuleId: known ? "R-009" : b.id,
    proposedText: known
      ? "Everyday customer-facing marketing copy follows the R-001 voice. Health, nutrition and regulatory statements must use precise, authoritative wording without slang or exaggeration."
      : `${b.text} (Clarification needed: define when this applies relative to ${a.id}.)`,
    status: "open",
    detectedBy: "Lexicon conflict detector (deterministic)",
  };
}

/** Rule pair that defines the tone tension for the deterministic tone check. */
export function toneConflict(rules: Rule[]) {
  return detectConflicts(rules).find((c) => c.dimension === "tone register");
}
