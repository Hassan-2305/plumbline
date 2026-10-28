import type { ApprovedFact, Brand, EvidenceRef, Rule } from "../types";

type BrandData = Pick<Brand, "rules" | "facts">;

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function isExpired(fact: ApprovedFact, today = todayISO()) {
  return !!fact.expires && fact.expires < today;
}

export function factState(fact: ApprovedFact, today = todayISO()) {
  if (fact.status === "pending") return "pending" as const;
  if (isExpired(fact, today)) return "expired" as const;
  return "active" as const;
}

export function ruleEvidence(rule: Rule, note?: string): EvidenceRef {
  return { type: "guideline", id: rule.id, excerpt: rule.text, verified: true, note };
}

export function factEvidence(fact: ApprovedFact, note?: string): EvidenceRef {
  return { type: "approved_fact", id: fact.id, excerpt: fact.statement, verified: true, note };
}

export function noFactEvidence(note: string): EvidenceRef {
  return {
    type: "no_fact",
    excerpt: "No approved supporting fact was found in the loaded fact library.",
    verified: true,
    note,
  };
}

/**
 * Re-resolves every evidence reference against the loaded brand data.
 * Excerpts are always replaced with the source record text — model-supplied
 * quotations are never displayed. Unknown IDs are kept but marked unverified.
 */
export function validateEvidence(refs: EvidenceRef[], brand: BrandData): EvidenceRef[] {
  return refs.map((r) => {
    if (r.type === "guideline") {
      const rule = brand.rules.find((x) => x.id === r.id);
      return rule
        ? { ...r, excerpt: rule.text, verified: true }
        : { ...r, excerpt: `Reference ${r.id ?? "(missing id)"} does not exist in the loaded guidelines.`, verified: false };
    }
    if (r.type === "approved_fact") {
      const fact = brand.facts.find((x) => x.id === r.id);
      return fact
        ? { ...r, excerpt: fact.statement, verified: true }
        : { ...r, excerpt: `Reference ${r.id ?? "(missing id)"} does not exist in the loaded fact library.`, verified: false };
    }
    return r;
  });
}

export function allVerified(refs: EvidenceRef[]) {
  return refs.length > 0 && refs.every((r) => r.verified);
}
