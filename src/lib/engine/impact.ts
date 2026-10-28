import type { Brand, ContentItem, DismissReason, DraftFinding, GuidelineChange, ImpactSummary, Rule, Severity } from "../types";
import { runDeterministic } from "./deterministic";

// "Test this change": replay the rule-based jury over review history under the
// current and the proposed guidelines, and score the difference against what
// humans actually decided. Deterministic only — no AI, no invented numbers.

export interface ImpactFinding {
  title: string;
  category: string;
  ruleIds: string[];
  severity: Severity;
  history: "dismissed" | "accepted" | "escalated" | null;
  reason?: DismissReason;
}

export interface ImpactRow {
  itemId: string;
  title: string;
  seeded: boolean;
  status: ContentItem["status"];
  removed: ImpactFinding[];
  added: ImpactFinding[];
  kept: number;
}

export interface ImpactReport {
  summary: ImpactSummary;
  rows: ImpactRow[];
  /** Findings reviewers had accepted as real that the change would stop raising. */
  lostAccepted: number;
}

const key = (f: Pick<DraftFinding, "category" | "ruleIds">) => `${f.category}|${[...f.ruleIds].sort().join(",")}`;

function reviseRule(r: Rule, text: string, title?: string): Rule {
  return { ...r, title: title ?? r.title, text, version: r.version + 1, history: [...r.history, { version: r.version, text: r.text, changedAt: "", reason: "proposed" }] };
}

/** Applies a proposed change to a copy of the brand, mirroring what approval would do. */
export function applyChange(brand: Brand, c: Pick<GuidelineChange, "kind" | "ruleId" | "title" | "text" | "term" | "replacement" | "avoid" | "role">): Brand {
  const b: Brand = structuredClone(brand);
  if (c.kind === "rule_edit" && c.ruleId && c.text) b.rules = b.rules.map((r) => (r.id === c.ruleId ? reviseRule(r, c.text!, c.title) : r));
  if (c.kind === "rule_add" && c.text) {
    const n = b.rules.reduce((m, r) => Math.max(m, parseInt(r.id.replace(/\D/g, ""), 10) || 0), 0) + 1;
    const id = `R-${String(n).padStart(3, "0")}`;
    b.rules = [...b.rules, { id, title: c.title || "New rule", text: c.text, version: 1, history: [] }];
    if (c.role) b.ruleRoles = { ...b.ruleRoles, [c.role]: id };
  }
  if (c.kind === "banned_add" && c.term && c.ruleId) b.bannedTerms = [...b.bannedTerms, { term: c.term, ruleId: c.ruleId, replacement: c.replacement }];
  if (c.kind === "preferred_add" && c.term && c.avoid?.length && c.ruleId) b.preferredTerms = [...b.preferredTerms, { prefer: c.term, avoid: c.avoid, ruleId: c.ruleId }];
  return b;
}

/** Applies a conflict clarification (replacement text for one rule). */
export function applyClarification(brand: Brand, ruleId: string, text: string): Brand {
  return applyChange(brand, { kind: "rule_edit", ruleId, text });
}

function historyFor(item: ContentItem) {
  const map = new Map<string, { status: ImpactFinding["history"]; reason?: DismissReason }[]>();
  for (const f of item.findings) {
    if (f.status === "open") continue;
    const last = [...f.history].reverse().find((h) => h.action !== "created" && h.action !== "reopened");
    const status: ImpactFinding["history"] = f.status === "dismissed" ? "dismissed" : f.status === "escalated" ? "escalated" : "accepted";
    const list = map.get(key(f)) ?? [];
    list.push({ status, reason: last?.reason });
    map.set(key(f), list);
  }
  return map;
}

/** Per-key maximum count across versions, so a finding present in v1 and v2 counts once. */
function unionAcross(texts: string[], run: (t: string) => DraftFinding[]) {
  const best = new Map<string, DraftFinding[]>();
  for (const t of texts) {
    const groups = new Map<string, DraftFinding[]>();
    for (const f of run(t)) groups.set(key(f), [...(groups.get(key(f)) ?? []), f]);
    for (const [k, list] of groups) if ((best.get(k)?.length ?? 0) < list.length) best.set(k, list);
  }
  return [...best.values()].flat();
}

export function testChange(items: ContentItem[], current: Brand, proposed: Brand, today?: string): ImpactReport {
  const rows: ImpactRow[] = [];
  let removed = 0,
    removedDismissed = 0,
    kept = 0,
    keptAccepted = 0,
    added = 0,
    approvedNowFailing = 0,
    lostAccepted = 0;

  let versionsTested = 0;
  for (const item of items) {
    // Every distinct version in the item's history; a finding counts once per item.
    const texts = [...new Set([...item.versions.map((v) => v.text), item.text])];
    versionsTested += texts.length;
    const before = unionAcross(texts, (t) => runDeterministic({ text: t, meta: item.meta, brand: current, today }).findings);
    const after = unionAcross(texts, (t) => runDeterministic({ text: t, meta: item.meta, brand: proposed, today }).findings);
    const latestAfter = runDeterministic({ text: item.text, meta: item.meta, brand: proposed, today }).findings;
    const latestBefore = runDeterministic({ text: item.text, meta: item.meta, brand: current, today }).findings;
    const hist = historyFor(item);
    const pool = [...after];
    const row: ImpactRow = { itemId: item.id, title: item.title, seeded: item.seeded, status: item.status, removed: [], added: [], kept: 0 };

    for (const f of before) {
      const i = pool.findIndex((a) => key(a) === key(f));
      const h = hist.get(key(f))?.[0];
      if (i >= 0) {
        pool.splice(i, 1);
        row.kept++;
        if (h?.status === "accepted") keptAccepted++;
      } else {
        row.removed.push({ title: f.title, category: f.category, ruleIds: f.ruleIds, severity: f.severity, history: h?.status ?? null, reason: h?.reason });
        if (h?.status === "dismissed") removedDismissed++;
        if (h?.status === "accepted") lostAccepted++;
      }
    }
    for (const f of pool) {
      row.added.push({ title: f.title, category: f.category, ruleIds: f.ruleIds, severity: f.severity, history: null });
    }
    removed += row.removed.length;
    kept += row.kept;
    added += row.added.length;
    // Approved content fails if its approved (latest) text gains a medium or high finding.
    const latestPool = [...latestBefore];
    const newOnLatest = latestAfter.filter((f) => {
      const i = latestPool.findIndex((b) => key(b) === key(f));
      if (i >= 0) {
        latestPool.splice(i, 1);
        return false;
      }
      return true;
    });
    if (item.status === "approved" && newOnLatest.some((f) => f.severity !== "low")) approvedNowFailing++;
    if (row.removed.length || row.added.length) rows.push(row);
  }

  const verdict: ImpactSummary["verdict"] = lostAccepted > 0 || approvedNowFailing > 0 ? "risky" : added > 0 ? "review" : "safe";
  return {
    summary: { at: new Date().toISOString(), versionsTested, removed, removedDismissed, kept, keptAccepted, added, lostAccepted, approvedNowFailing, verdict },
    rows,
    lostAccepted,
  };
}
