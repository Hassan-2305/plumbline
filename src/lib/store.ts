"use client";

import { useSyncExternalStore } from "react";
import type {
  AppState,
  AiLedgerEntry,
  FeedbackEntry,
  ImpactSummary,
  Role,
  ApprovedFact,
  Brand,
  GuidelineChange,
  ImageAnalysis,
  Rule,
  RuleRole,
  ContentItem,
  ContentMeta,
  ContentType,
  DismissReason,
  DraftFinding,
  Finding,
  GuidelineConflict,
  ReviewRun,
} from "./types";
import { NORTHSTAR } from "./seed/brand";
import { EXAMPLES } from "./seed/examples";
import { seededHistory } from "./seed/history";
import { conflictFromDetection, detectConflicts } from "./engine/conflicts";
import { runDeterministic } from "./engine/deterministic";
import { coordinate, signature } from "./engine/coordinator";
import { applyLocalFix } from "./engine/diff";
import { numberTokens } from "./engine/text";
import { can, roleMeta } from "./roles";

// Prototype persistence in localStorage. Not secure, not multi-user, not tamper-proof.

const KEY = "plumbline-jury:v1";
const SCHEMA = 4;

export function initialState(): AppState {
  const brand = structuredClone(NORTHSTAR);
  return {
    schema: SCHEMA,
    brands: [brand],
    activeBrandId: brand.id,
    items: seededHistory(),
    conflicts: detectConflicts(brand.rules).map((d) => conflictFromDetection(d, brand.rules, brand.id)),
    role: "creator",
    aiLedger: [],
    seededAt: new Date().toISOString(),
  };
}

let state: AppState | null = null;
let storageNotice: string | null = null;
const listeners = new Set<() => void>();

function isValid(s: unknown): s is AppState {
  const x = s as AppState;
  return !!x && [1, 2, 3, SCHEMA].includes(x.schema) && Array.isArray(x.brands) && x.brands.length > 0 && Array.isArray(x.items) && Array.isArray(x.conflicts);
}

/** v1 → v2: change requests and changelog. v2 → v3: rule roles, brand-scoped conflicts. */
function migrate(s: AppState): AppState {
  if (s.schema === SCHEMA) return s;
  return {
    ...s,
    schema: SCHEMA,
    brands: s.brands.map((b) => ({
      ...b,
      changes: b.changes ?? [],
      changelog: b.changelog ?? [],
      ruleRoles: b.ruleRoles ?? (b.id === NORTHSTAR.id ? NORTHSTAR.ruleRoles : {}),
    })),
    conflicts: s.conflicts.map((c) => ({ ...c, brandId: c.brandId ?? s.brands[0].id })),
    // v3 → v4: three roles (writer → creator), comments and the AI ledger.
    role: (s.role as string) === "writer" ? "creator" : s.role,
    aiLedger: s.aiLedger ?? [],
    items: s.items.map((i) => ({ ...i, comments: i.comments ?? [] })),
  };
}

function load(): AppState {
  if (typeof window === "undefined") return initialState();
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    storageNotice = "Local storage is unavailable in this browser. Running from the demo dataset; changes will not persist.";
    return initialState();
  }
  if (!raw) return initialState();
  try {
    const parsed = JSON.parse(raw);
    if (isValid(parsed)) return migrate(parsed);
  } catch {
    // fall through
  }
  storageNotice = "Saved data was unreadable or from an incompatible version, so the original demo was restored.";
  return initialState();
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    storageNotice = "Could not save to local storage (blocked or full). Changes will be lost on refresh.";
  }
}

function getState(): AppState {
  if (!state) {
    state = load();
    persist();
  }
  return state;
}

function set(updater: (s: AppState) => AppState) {
  state = updater(getState());
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Returns null during SSR/hydration so pages can render a skeleton. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, getState, () => null);
}

export function useStorageNotice() {
  useAppState();
  return storageNotice;
}

export function dismissStorageNotice() {
  storageNotice = null;
  listeners.forEach((l) => l());
}

// ---------- helpers ----------

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

export function actor(s: AppState) {
  return roleMeta(s.role).person;
}

export function activeBrand(s: AppState) {
  return s.brands.find((b) => b.id === s.activeBrandId) ?? s.brands[0];
}

function updateItem(id: string, fn: (item: ContentItem, s: AppState) => ContentItem) {
  set((s) => ({
    ...s,
    items: s.items.map((it) => (it.id === id ? { ...fn(it, s), updatedAt: now() } : it)),
  }));
}

function nextFindingNumber(item: ContentItem) {
  return item.findings.reduce((m, f) => Math.max(m, parseInt(f.id.replace(/\D/g, ""), 10) || 0), 0) + 1;
}

export function unresolvedHighRisk(item: ContentItem) {
  return item.findings.filter((f) => f.severity === "high" && (f.status === "open" || f.status === "escalated"));
}

// ---------- actions ----------

export function resetDemo() {
  state = initialState();
  storageNotice = null;
  persist();
  listeners.forEach((l) => l());
}

/** Restores the demo brand, its conflicts and seeded history; keeps user drafts and user-created brands. */
export function loadDemo() {
  set((s) => {
    const fresh = initialState();
    const userItems = s.items.filter((i) => !i.seeded);
    const userBrands = s.brands.filter((b) => b.id !== NORTHSTAR.id);
    return {
      ...fresh,
      brands: [...fresh.brands, ...userBrands],
      conflicts: [...fresh.conflicts, ...s.conflicts.filter((c) => c.brandId !== NORTHSTAR.id)],
      items: [...fresh.items, ...userItems],
      role: s.role,
      aiLedger: s.aiLedger,
      feedback: s.feedback,
    };
  });
}

export function setActiveBrand(id: string) {
  set((s) => (s.brands.some((b) => b.id === id) ? { ...s, activeBrandId: id } : s));
}

/** Generic starting rules for a new brand. Each maps to a built-in check. */
const STARTER_RULES: { title: string; text: string; role?: RuleRole }[] = [
  { title: "Brand voice", text: "Write clearly and concisely for the intended audience." },
  { title: "No sensationalism", text: "Avoid sensationalist language, unsupported superlatives and absolute guarantees.", role: "sensational" },
  { title: "Regulated claims", text: "Health, financial, environmental and performance claims require approved supporting evidence.", role: "health" },
  { title: "Numerical claims", text: "Numerical claims must match approved facts.", role: "numbers" },
  { title: "Fact expiry", text: "Expired facts cannot support current promotional claims.", role: "expiry" },
  { title: "Accessibility", text: "Customer-facing content must meet applicable accessibility requirements.", role: "accessibility" },
  { title: "Visual identity", text: "Use approved logos and brand colours.", role: "visual" },
];

export function createBrand(input: { name: string; description: string; palette: { name: string; hex: string }[]; start: "empty" | "starter" | "copy" }) {
  const s = getState();
  const base = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";
  let id = base;
  for (let n = 2; s.brands.some((b) => b.id === id); n++) id = `${base}-${n}`;
  const at = now();
  const src = activeBrand(s);
  let rules: Rule[] = [];
  const ruleRoles: NonNullable<Brand["ruleRoles"]> = {};
  if (input.start === "starter") {
    rules = STARTER_RULES.map((r, i) => ({ id: `R-${String(i + 1).padStart(3, "0")}`, title: r.title, text: r.text, version: 1, history: [] }));
    STARTER_RULES.forEach((r, i) => {
      if (r.role) ruleRoles[r.role] = rules[i].id;
    });
  } else if (input.start === "copy") {
    rules = src.rules.map((r) => ({ ...r, version: 1, history: [] }));
    Object.assign(ruleRoles, src.ruleRoles);
  }
  const brand: Brand = {
    id,
    name: input.name.trim(),
    description: input.description.trim(),
    fictional: false,
    rules,
    ruleRoles,
    facts: input.start === "copy" ? structuredClone(src.facts) : [],
    bannedTerms: input.start === "copy" ? structuredClone(src.bannedTerms) : [],
    preferredTerms: input.start === "copy" ? structuredClone(src.preferredTerms) : [],
    palette: input.palette,
    changes: [],
    changelog: [
      {
        at,
        by: actor(s),
        text: `Brand created (${input.start === "copy" ? `rules copied from ${src.name}` : input.start === "starter" ? "starter rules" : "no rules yet"}).`,
      },
    ],
  };
  set((st) => ({
    ...st,
    brands: [...st.brands, brand],
    activeBrandId: id,
    conflicts: [...st.conflicts, ...detectConflicts(rules).map((d) => conflictFromDetection(d, rules, id))],
  }));
  return id;
}

export function deleteBrand(id: string) {
  if (id === NORTHSTAR.id) return;
  set((s) => ({
    ...s,
    brands: s.brands.filter((b) => b.id !== id),
    items: s.items.filter((i) => i.brandId !== id),
    conflicts: s.conflicts.filter((c) => c.brandId !== id),
    activeBrandId: s.activeBrandId === id ? NORTHSTAR.id : s.activeBrandId,
  }));
}

export function setRole(role: AppState["role"]) {
  set((s) => ({ ...s, role }));
}

export function createItem(input: { title: string; contentType: ContentType; text: string; meta: ContentMeta }) {
  const id = uid("c");
  const at = now();
  const s = getState();
  const item: ContentItem = {
    id,
    title: input.title || "Untitled draft",
    brandId: s.activeBrandId,
    contentType: input.contentType,
    status: "draft",
    text: input.text,
    meta: input.meta,
    versions: [{ id: uid("v"), number: 1, text: input.text, createdAt: at, label: "Original" }],
    findings: [],
    matchedFacts: [],
    runs: [],
    approvals: [],
    events: [{ at, by: actor(s), text: "Draft created." }],
    seeded: false,
    createdAt: at,
    updatedAt: at,
  };
  set((st) => ({ ...st, items: [item, ...st.items] }));
  return id;
}

/** Creates an item from a demo scenario and runs deterministic checks plus labelled seeded jury results. */
export function createFromExample(exampleId: string) {
  const ex = EXAMPLES.find((e) => e.id === exampleId) ?? EXAMPLES[0];
  // Demo scenarios are written for the Northstar demo brand.
  if (getState().brands.some((b) => b.id === NORTHSTAR.id)) setActiveBrand(NORTHSTAR.id);
  const id = createItem({ title: `Demo ${ex.id}: ${ex.title}`, contentType: ex.contentType, text: ex.text, meta: { ...ex.meta } });
  commitReview(id, { aiFindings: ex.seededJury, mode: "seeded", aiStatus: "seeded" });
  return id;
}

export function updateDraft(id: string, patch: Partial<Pick<ContentItem, "title" | "text" | "meta" | "contentType">>) {
  updateItem(id, (it, s) => {
    const next = { ...it, ...patch, meta: patch.meta ? { ...it.meta, ...patch.meta } : it.meta };
    const textChanged = patch.text !== undefined && patch.text !== it.text;
    if (textChanged && (it.status === "approved" || it.status === "under_review")) {
      next.status = "draft";
      next.events = [...it.events, { at: now(), by: actor(s), text: `Text edited after ${it.status === "approved" ? "approval — approval no longer applies to the current text" : "submission — withdrawn from review"}.` }];
    }
    return next;
  });
}

function snapshotVersion(it: ContentItem, label: string): ContentItem {
  const last = it.versions[it.versions.length - 1];
  if (last && last.text === it.text) return it;
  return {
    ...it,
    versions: [...it.versions, { id: uid("v"), number: (last?.number ?? 0) + 1, text: it.text, createdAt: now(), label }],
  };
}

export function commitReview(
  id: string,
  opts: { aiFindings?: DraftFinding[]; mode: ReviewRun["mode"]; aiStatus: ReviewRun["aiStatus"]; aiError?: string; model?: string },
) {
  updateItem(id, (item, s) => {
    const brand = s.brands.find((b) => b.id === item.brandId) ?? activeBrand(s);
    let it = snapshotVersion(item, "Edited draft");
    const det = runDeterministic({ text: it.text, meta: it.meta, brand });
    const merged = coordinate(det.findings, opts.aiFindings ?? []);
    // Keep decided findings as history; replace open ones; don't resurrect dismissed duplicates.
    // Without new AI output, earlier open AI/seeded judgements stay if their text is still present.
    const lowerText = it.text.toLowerCase();
    const kept = it.findings.filter(
      (f) =>
        f.status !== "open" ||
        (!opts.aiFindings && f.source !== "deterministic" && (!f.offendingText || lowerText.includes(f.offendingText.toLowerCase()))),
    );
    const keptSigs = new Set(kept.map(signature));
    let n = nextFindingNumber(it);
    const at = now();
    const fresh: Finding[] = merged
      .filter((d) => !keptSigs.has(signature(d)))
      .map((d) => ({
        ...d,
        id: `finding-${String(n++).padStart(3, "0")}`,
        status: "open",
        history: [{ action: "created", at, by: d.source === "deterministic" ? "Deterministic checks" : d.source === "ai" ? `AI-assisted ${d.juror}` : "Seeded demo result" }],
      }));
    const version = it.versions[it.versions.length - 1].number;
    const run: ReviewRun = {
      id: uid("run"),
      at,
      mode: opts.mode,
      aiStatus: opts.aiStatus,
      aiError: opts.aiError,
      model: opts.model,
      versionNumber: version,
      findingCount: fresh.length,
      notices: det.inputErrors.length ? det.inputErrors : undefined,
    };
    it = {
      ...it,
      findings: [...kept, ...fresh],
      matchedFacts: det.matchedFacts,
      runs: [...it.runs, run],
      status: it.status === "approved" ? "approved" : it.status === "under_review" ? "under_review" : it.status,
      events: [
        ...it.events,
        {
          at,
          by: actor(s),
          text: `Jury review on v${version}: ${fresh.length} new finding(s). ${opts.mode === "seeded" ? "Includes seeded demo results." : opts.aiStatus === "ok" ? `Live AI (${opts.model}).` : opts.aiStatus === "failed" ? `AI failed: ${opts.aiError}` : "Deterministic only."}`,
        },
      ],
    };
    return it;
  });
}

function pushDecision(f: Finding, d: Finding["history"][number]): Finding {
  return { ...f, history: [...f.history, d] };
}

export function acceptFix(id: string, findingId: string, replacementOverride?: string): string | null {
  let error: string | null = null;
  updateItem(id, (it, s) => {
    const f = it.findings.find((x) => x.id === findingId);
    if (!f) return it;
    const replacement = replacementOverride ?? f.replacement;
    if (!f.offendingText || replacement === undefined) {
      error = "This finding has no local text fix. Edit the content directly.";
      return it;
    }
    const nextText = applyLocalFix(it.text, f.offendingText, replacement);
    if (nextText === null) {
      error = "The flagged text is no longer in the draft, so the fix could not be applied.";
      return it;
    }
    const action = replacementOverride !== undefined && replacementOverride !== f.replacement ? "edited" : "accepted";
    const at = now();
    const base = snapshotVersion(it, "Edited draft");
    const lastNum = base.versions[base.versions.length - 1].number;
    return {
      ...base,
      text: nextText,
      status: it.status === "approved" || it.status === "under_review" ? "draft" : it.status,
      versions: [...base.versions, { id: uid("v"), number: lastNum + 1, text: nextText, createdAt: at, label: `${action === "edited" ? "Edited fix" : "Accepted fix"} ${f.id}` }],
      findings: base.findings.map((x) =>
        x.id === findingId
          ? pushDecision({ ...x, status: action }, { action, at, by: actor(s), before: f.offendingText, after: replacement })
          : x,
      ),
      events: [...base.events, { at, by: actor(s), text: `${action === "edited" ? "Applied edited fix" : "Accepted fix"} for ${f.id}: "${f.offendingText}" → "${replacement}".` }],
    };
  });
  return error;
}

export function dismissFinding(id: string, findingId: string, reason: DismissReason, note: string) {
  updateItem(id, (it, s) => {
    const at = now();
    return {
      ...it,
      findings: it.findings.map((f) =>
        f.id === findingId ? pushDecision({ ...f, status: "dismissed" }, { action: "dismissed", at, by: actor(s), reason, note }) : f,
      ),
      events: [...it.events, { at, by: actor(s), text: `Dismissed ${findingId} — ${reason}${note ? `: ${note}` : ""}.` }],
    };
  });
}

export function escalateFinding(id: string, findingId: string, note: string) {
  updateItem(id, (it, s) => {
    const at = now();
    return {
      ...it,
      findings: it.findings.map((f) =>
        f.id === findingId ? pushDecision({ ...f, status: "escalated" }, { action: "escalated", at, by: actor(s), note }) : f,
      ),
      events: [...it.events, { at, by: actor(s), text: `Escalated ${findingId}${note ? `: ${note}` : ""}.` }],
    };
  });
}

export function reopenFinding(id: string, findingId: string) {
  updateItem(id, (it, s) => {
    const at = now();
    return {
      ...it,
      findings: it.findings.map((f) =>
        f.id === findingId ? pushDecision({ ...f, status: "open" }, { action: "reopened", at, by: actor(s) }) : f,
      ),
      events: [...it.events, { at, by: actor(s), text: `Reopened ${findingId}.` }],
    };
  });
}

export function submitForApproval(id: string) {
  if (!can(getState().role, "content.submit")) return;
  updateItem(id, (it, s) => {
    const base = snapshotVersion(it, "Submitted draft");
    return {
      ...base,
      status: "under_review",
      events: [...base.events, { at: now(), by: actor(s), text: `Submitted v${base.versions[base.versions.length - 1].number} for approval.` }],
    };
  });
}

/** What the current role may decide on an item, and why not. */
export function approvalRights(item: ContentItem, role: Role) {
  const blockers = unresolvedHighRisk(item);
  const escalated = item.findings.filter((f) => f.status === "escalated");
  const canApproveClean = can(role, "content.approve") && blockers.length === 0 && (escalated.length === 0 || can(role, "content.override"));
  const canOverride = can(role, "content.override") && (blockers.length > 0 || escalated.length > 0);
  let reason: string | undefined;
  if (!can(role, "content.approve")) reason = "Only a manager or reviewer can approve.";
  else if (!canApproveClean && !canOverride) {
    reason = blockers.length
      ? "High-risk findings are open. Only an authorised reviewer can override them."
      : "Escalated findings need an authorised reviewer.";
  }
  return { blockers, escalated, canApproveClean, canOverride, canRequestChanges: can(role, "content.requestChanges"), reason };
}

export function decideApproval(id: string, decision: "approved" | "changes_requested", note: string, overrideReason?: string) {
  const role = getState().role;
  updateItem(id, (it, s) => {
    const at = now();
    const rights = approvalRights(it, role);
    if (decision === "changes_requested" && !rights.canRequestChanges) return it;
    const overridden = [...rights.blockers, ...rights.escalated.filter((e) => !rights.blockers.includes(e))];
    if (decision === "approved") {
      if (!rights.canApproveClean && !(rights.canOverride && overrideReason?.trim())) return it;
    }
    const usedOverride = decision === "approved" && overridden.length > 0;
    const version = it.versions[it.versions.length - 1].number;
    const by = actor(s);
    return {
      ...it,
      status: decision,
      approvals: [
        ...it.approvals,
        {
          decision,
          at,
          reviewer: by,
          note,
          versionNumber: version,
          overriddenFindingIds: usedOverride ? overridden.map((b) => b.id) : [],
          overrideReason: usedOverride ? overrideReason : undefined,
        },
      ],
      events: [
        ...it.events,
        {
          at,
          by,
          text:
            decision === "approved"
              ? `Approved v${version}${usedOverride ? ` with override of ${overridden.map((b) => b.id).join(", ")}: ${overrideReason}` : ""}.`
              : `Requested changes on v${version}${note ? `: ${note}` : ""}.`,
        },
      ],
    };
  });
}

// ---------- comments ----------

const MENTION = /@(creator|manager|reviewer)\b/gi;

export function addComment(itemId: string, text: string, findingId?: string) {
  const s = getState();
  if (!can(s.role, "comment") || !text.trim()) return;
  const mentions = [...new Set([...text.matchAll(MENTION)].map((m) => m[1].toLowerCase() as Role))];
  updateItem(itemId, (it, st) => ({
    ...it,
    comments: [
      ...(it.comments ?? []),
      { id: uid("cm"), at: now(), by: actor(st), role: st.role, text: text.trim(), findingId, mentions },
    ],
    events: [...it.events, { at: now(), by: actor(st), text: `Commented${findingId ? ` on ${findingId}` : ""}${mentions.length ? ` (mentioned ${mentions.join(", ")})` : ""}.` }],
  }));
}

export function resolveComment(itemId: string, commentId: string, resolved = true) {
  updateItem(itemId, (it) => ({
    ...it,
    comments: (it.comments ?? []).map((c) => (c.id === commentId ? { ...c, resolved } : c)),
  }));
}

/** Unresolved comments that mention a role, across the brand in view. */
export function mentionsFor(s: AppState, role: Role) {
  return brandItems(s).flatMap((i) => (i.comments ?? []).filter((c) => !c.resolved && c.mentions.includes(role)).map((c) => ({ item: i, comment: c })));
}

export function deleteItem(id: string) {
  set((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));
}

// ---------- guideline governance (reviewer approval required) ----------

const REVIEWER = roleMeta("reviewer").person;

function updateBrand(s: AppState, fn: (b: Brand) => Brand): AppState {
  return { ...s, brands: s.brands.map((b) => (b.id === s.activeBrandId ? fn(b) : b)) };
}

function log(b: Brand, by: string, text: string): Brand {
  return { ...b, changelog: [...(b.changelog ?? []), { at: now(), by, text }] };
}

function reviseRule(r: Rule, text: string, reason: string, title?: string): Rule {
  return {
    ...r,
    title: title ?? r.title,
    text,
    version: r.version + 1,
    history: [...r.history, { version: r.version, text: r.text, changedAt: now(), reason }],
  };
}

function nextId(prefix: "R" | "F", ids: string[]) {
  const n = ids.reduce((m, id) => Math.max(m, parseInt(id.replace(/\D/g, ""), 10) || 0), 0) + 1;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

/** Only the simulated reviewer role may change approved guidelines. */
export function isReviewer() {
  return can(getState().role, "guideline.approve");
}

export function decideConflict(conflictId: string, decision: "approved" | "rejected", text: string, note: string) {
  if (!isReviewer()) return;
  set((s) => {
    const c = s.conflicts.find((x) => x.id === conflictId);
    if (!c) return s;
    const at = now();
    let next = s;
    if (decision === "approved") {
      next = updateBrand(s, (b) =>
        log(
          { ...b, rules: b.rules.map((r) => (r.id === c.proposedRuleId ? reviseRule(r, text, `Clarified via conflict ${c.id}${note ? `: ${note}` : ""}`) : r)) },
          REVIEWER,
          `Approved clarification of ${c.proposedRuleId} (conflict ${c.ruleIds.join(" ↔ ")}).`,
        ),
      );
    } else {
      next = updateBrand(s, (b) => log(b, REVIEWER, `Rejected proposed clarification for ${c.ruleIds.join(" ↔ ")}.`));
    }
    return {
      ...next,
      conflicts: next.conflicts.map((x) => (x.id === conflictId ? { ...x, status: decision, decidedAt: at, decisionNote: note, proposedText: text } : x)),
    };
  });
}

export function addConflicts(conflicts: Omit<GuidelineConflict, "brandId">[]) {
  set((s) => ({
    ...s,
    conflicts: [
      ...s.conflicts,
      ...conflicts.filter((c) => !s.conflicts.some((x) => x.id === c.id)).map((c) => ({ ...c, brandId: s.activeBrandId })),
    ],
  }));
}

/** Conflicts belonging to the brand currently in view. */
export function brandConflicts(s: AppState) {
  return s.conflicts.filter((c) => c.brandId === s.activeBrandId);
}

/** Content items belonging to the brand currently in view. */
export function brandItems(s: AppState) {
  return s.items.filter((i) => i.brandId === s.activeBrandId);
}

export function proposeChange(change: Omit<GuidelineChange, "id" | "proposedBy" | "proposedAt" | "status">) {
  set((s) =>
    updateBrand(s, (b) => ({
      ...b,
      changes: [...(b.changes ?? []), { ...change, id: uid("chg"), proposedBy: actor(s), proposedAt: now(), status: "pending" }],
    })),
  );
}

export function decideChange(id: string, decision: "approved" | "rejected", note: string) {
  if (!isReviewer()) return;
  set((s) =>
    withDetectedConflicts(updateBrand(s, (b) => {
      const c = (b.changes ?? []).find((x) => x.id === id);
      if (!c || c.status !== "pending") return b;
      const decided: GuidelineChange = { ...c, status: decision, decidedBy: REVIEWER, decidedAt: now(), decisionNote: note };
      let nb: Brand = { ...b, changes: b.changes.map((x) => (x.id === id ? decided : x)) };
      if (decision === "rejected") return log(nb, REVIEWER, `Rejected proposal: ${describeChange(c)}.`);
      if (c.kind === "rule_edit" && c.ruleId && c.text) {
        nb = { ...nb, rules: nb.rules.map((r) => (r.id === c.ruleId ? reviseRule(r, c.text!, c.reason, c.title) : r)) };
      } else if (c.kind === "rule_add" && c.text) {
        const rid = nextId("R", nb.rules.map((r) => r.id));
        nb = { ...nb, rules: [...nb.rules, { id: rid, title: c.title || "New rule", text: c.text, version: 1, history: [] }] };
        if (c.role) nb = { ...nb, ruleRoles: { ...nb.ruleRoles, [c.role]: rid } };
        nb = { ...nb, changes: nb.changes.map((x) => (x.id === id ? { ...decided, ruleId: rid } : x)) };
      } else if (c.kind === "banned_add" && c.term && c.ruleId) {
        nb = { ...nb, bannedTerms: [...nb.bannedTerms, { term: c.term, ruleId: c.ruleId, replacement: c.replacement || undefined }] };
      } else if (c.kind === "preferred_add" && c.term && c.avoid?.length && c.ruleId) {
        nb = { ...nb, preferredTerms: [...nb.preferredTerms, { prefer: c.term, avoid: c.avoid, ruleId: c.ruleId }] };
      }
      return log(nb, REVIEWER, `Approved: ${describeChange(c)}.`);
    })),
  );
}

/** Re-runs conflict detection after rules change; only adds conflicts not seen before. */
function withDetectedConflicts(s: AppState): AppState {
  const b = activeBrand(s);
  const found = detectConflicts(b.rules)
    .map((d) => conflictFromDetection(d, b.rules, b.id))
    .filter((c) => !s.conflicts.some((x) => x.id === c.id));
  return found.length ? { ...s, conflicts: [...s.conflicts, ...found] } : s;
}

export function describeChange(c: GuidelineChange) {
  switch (c.kind) {
    case "rule_edit":
      return `edit ${c.ruleId}`;
    case "rule_add":
      return `new rule "${c.title}"`;
    case "banned_add":
      return `ban "${c.term}" under ${c.ruleId}`;
    case "preferred_add":
      return `prefer "${c.term}" over ${c.avoid?.map((a) => `"${a}"`).join(", ")}`;
  }
}

/** New facts always start as pending; a reviewer approves them. */
export function addFact(input: { statement: string; source: string; expires?: string; keyPhrase?: string }) {
  set((s) =>
    updateBrand(s, (b) => {
      const id = nextId("F", b.facts.map((f) => f.id));
      const signals = [
        ...numberTokens(input.statement).map((t) => t.raw),
        ...(input.keyPhrase?.trim() ? [input.keyPhrase.trim()] : []),
      ];
      const fact: ApprovedFact = {
        id,
        statement: input.statement.trim(),
        source: input.source.trim() || "Not specified",
        lastVerified: now().slice(0, 10),
        expires: input.expires || undefined,
        status: "pending",
        signals: signals.length ? signals : [input.statement.trim().slice(0, 40)],
      };
      return log({ ...b, facts: [...b.facts, fact] }, actor(s), `Proposed fact ${id} (pending approval).`);
    }),
  );
}

export function approveFact(id: string) {
  if (!isReviewer()) return;
  set((s) =>
    updateBrand(s, (b) =>
      log({ ...b, facts: b.facts.map((f) => (f.id === id ? { ...f, status: "approved", lastVerified: now().slice(0, 10) } : f)) }, REVIEWER, `Approved fact ${id}.`),
    ),
  );
}

export function reverifyFact(id: string, expires: string) {
  if (!isReviewer()) return;
  set((s) =>
    updateBrand(s, (b) =>
      log(
        { ...b, facts: b.facts.map((f) => (f.id === id ? { ...f, lastVerified: now().slice(0, 10), expires: expires || undefined } : f)) },
        REVIEWER,
        `Re-verified fact ${id}${expires ? `; new expiry ${expires}` : "; no expiry"}.`,
      ),
    ),
  );
}

export function setReferenceLogo(logo: ImageAnalysis | undefined) {
  if (!isReviewer()) return;
  set((s) => updateBrand(s, (b) => log({ ...b, logo }, REVIEWER, logo ? `Set reference logo to ${logo.fileName}.` : "Removed reference logo.")));
}

// ---------- privacy ----------

/** Records an external AI request (successful or not) for the disclosure ledger. */
export function recordAiCall(entry: Omit<AiLedgerEntry, "id" | "at" | "by" | "brandId">) {
  set((s) => ({
    ...s,
    aiLedger: [
      { ...entry, id: uid("ai"), at: now(), by: actor(s), brandId: s.activeBrandId, sentPreview: entry.sentPreview.slice(0, 1500) },
      ...(s.aiLedger ?? []),
    ].slice(0, 200),
  }));
}

export function setConfidential(itemId: string, confidential: boolean) {
  updateItem(itemId, (it, s) => ({
    ...it,
    confidential,
    events: [...it.events, { at: now(), by: actor(s), text: confidential ? "Marked confidential: AI review blocked for this item." : "Confidential flag removed." }],
  }));
}

export function setSensitiveTerms(terms: string[]) {
  set((s) =>
    updateBrand(s, (b) =>
      log({ ...b, sensitiveTerms: [...new Set(terms.map((t) => t.trim()).filter(Boolean))] }, actor(s), "Updated confidential terms that are never sent to AI."),
    ),
  );
}

/** Saves a "Test this change" result on the conflict or proposal it was run for. */
export function saveImpact(target: { conflictId?: string; changeId?: string }, impact: ImpactSummary) {
  set((s) => {
    if (target.conflictId) return { ...s, conflicts: s.conflicts.map((c) => (c.id === target.conflictId ? { ...c, impact } : c)) };
    return updateBrand(s, (b) => ({ ...b, changes: b.changes.map((c) => (c.id === target.changeId ? { ...c, impact } : c)) }));
  });
}

export function addFeedback(entry: Omit<FeedbackEntry, "id" | "at" | "role">) {
  set((s) => ({ ...s, feedback: [{ ...entry, id: uid("fb"), at: now(), role: s.role }, ...(s.feedback ?? [])] }));
}
