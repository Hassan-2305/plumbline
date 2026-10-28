import type { AppState, DismissReason, Finding } from "./types";
import { DISMISS_REASONS } from "./types";

// All statistics are computed from stored items. Seeded demo history is included
// only when requested and is always reported separately.

export interface RuleStat {
  ruleId: string;
  title: string;
  flagged: number;
  dismissed: number;
  unclear: number;
  accepted: number;
  escalated: number;
  dismissRate: number;
  examples: { item: string; reason?: DismissReason; note?: string; seeded: boolean }[];
}

export function computeInsights(s: AppState, includeSeeded: boolean) {
  const all = s.items.filter((i) => i.brandId === s.activeBrandId);
  const items = all.filter((i) => includeSeeded || !i.seeded);
  const brand = s.brands.find((b) => b.id === s.activeBrandId) ?? s.brands[0];
  const findings: { f: Finding; item: string; seeded: boolean }[] = items.flatMap((i) =>
    i.findings.map((f) => ({ f, item: i.title, seeded: i.seeded })),
  );

  const byRule = new Map<string, RuleStat>();
  for (const { f, item, seeded } of findings) {
    for (const ruleId of f.ruleIds) {
      const rule = brand.rules.find((r) => r.id === ruleId);
      const st =
        byRule.get(ruleId) ??
        { ruleId, title: rule?.title ?? ruleId, flagged: 0, dismissed: 0, unclear: 0, accepted: 0, escalated: 0, dismissRate: 0, examples: [] };
      st.flagged++;
      if (f.status === "dismissed") {
        st.dismissed++;
        const d = [...f.history].reverse().find((h) => h.action === "dismissed");
        if (d?.reason === "Rule unclear") st.unclear++;
        st.examples.push({ item, reason: d?.reason, note: d?.note, seeded });
      }
      if (f.status === "accepted" || f.status === "edited") st.accepted++;
      if (f.status === "escalated") st.escalated++;
      byRule.set(ruleId, st);
    }
  }
  const rules = [...byRule.values()].map((r) => ({ ...r, dismissRate: r.flagged ? r.dismissed / r.flagged : 0 }));

  const reasons = DISMISS_REASONS.map((reason) => ({
    reason,
    count: findings.filter(({ f }) => f.status === "dismissed" && [...f.history].reverse().find((h) => h.action === "dismissed")?.reason === reason).length,
  }));

  // Confusion signal: repeated "Rule unclear" OR high dismissal rate with enough volume.
  const confusing = rules
    .filter((r) => r.unclear >= 2 || (r.flagged >= 3 && r.dismissRate >= 0.5))
    .sort((a, b) => b.unclear - a.unclear || b.dismissRate - a.dismissRate);

  const open = findings.filter(({ f }) => f.status === "open" || f.status === "escalated");
  return {
    totalReviews: items.reduce((n, i) => n + i.runs.length, 0),
    itemsReviewed: items.filter((i) => i.runs.length > 0).length,
    openFindings: open.length,
    highRiskOpen: open.filter(({ f }) => f.severity === "high").length,
    approved: items.filter((i) => i.status === "approved").length,
    totalFindings: findings.length,
    dismissed: findings.filter(({ f }) => f.status === "dismissed").length,
    accepted: findings.filter(({ f }) => f.status === "accepted" || f.status === "edited").length,
    topFlagged: [...rules].sort((a, b) => b.flagged - a.flagged).slice(0, 8),
    topDismissed: [...rules].filter((r) => r.dismissed > 0).sort((a, b) => b.dismissed - a.dismissed).slice(0, 8),
    reasons,
    confusing,
    seededItems: all.filter((i) => i.seeded).length,
    userItems: all.filter((i) => !i.seeded).length,
  };
}
