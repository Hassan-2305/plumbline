"use client";

import { AlertTriangle, ArrowRight, Check, FileText, Lock, CheckCircle2, CircleSlash, FlaskConical, Gavel, Loader2, PenLine, ScanText, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Badge, Button, Card, Disclosure, IconChip, Label, SectionTitle, Skeleton, StatusBadge, Tabs, cx, fmtDate, inputCls } from "@/components/ui";
import { FindingCard } from "./FindingCard";
import { VersionsPanel } from "./VersionsPanel";
import { ApprovalPanel } from "./ApprovalPanel";
import { ImagePanel } from "./ImagePanel";
import { VideoPanel } from "./VideoPanel";
import { CommentThread } from "./CommentThread";
import { pageOfQuote, joinPages } from "@/lib/import/pages";
import { extractDocument } from "@/lib/import/extract";
import { recordAiCall, setConfidential, activeBrand, commitReview, createItem, setActiveBrand, unresolvedHighRisk, updateDraft, useAppState } from "@/lib/store";
import { useAiStatus } from "@/lib/useAiStatus";
import { redact, restore } from "@/lib/privacy/redact";
import { runDeterministic } from "@/lib/engine/deterministic";
import { contrastRatio, normalizeHex } from "@/lib/engine/contrast";
import { EXAMPLES } from "@/lib/seed/examples";
import type { AiReviewResponse, ContentItem, ContentMeta, ContentType, Finding, Juror, Severity } from "@/lib/types";
import { CONTENT_TYPES, JURORS } from "@/lib/types";

const MAX = 60000;
/** The AI route accepts up to 8,000 characters; longer documents get rule-based checks only. */
const AI_MAX = 8000;
const EMPTY_META: ContentMeta = { hasImage: false, altText: "", fg: "", bg: "" };
type Tab = "findings" | "discussion" | "versions" | "approval" | "activity";
const SEV_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const isOpen = (f: Finding) => f.status === "open" || f.status === "escalated";

export function Workspace({ itemId, prefill }: { itemId: string | null; prefill?: string }) {
  const state = useAppState();
  const router = useRouter();
  const ai = useAiStatus();
  const ex = EXAMPLES.find((e) => e.id === prefill);
  const [local, setLocal] = useState({
    title: ex ? `Demo ${ex.id}: ${ex.title}` : "",
    contentType: (ex?.contentType ?? "Social post") as ContentType,
    text: ex?.text ?? "",
    meta: ex ? { ...ex.meta } : EMPTY_META,
  });
  const [useAi, setUseAi] = useState(true);
  const [phase, setPhase] = useState<"idle" | "ai">("idle");
  const [pendingDet, setPendingDet] = useState(0);
  const [banner, setBanner] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [tab, setTab] = useState<Tab>("findings");
  const [mode, setMode] = useState<"annotated" | "edit" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confidentialLocal, setConfidentialLocal] = useState(false);

  const item = state && itemId ? state.items.find((i) => i.id === itemId) : undefined;
  // An existing item is always reviewed against its own brand.
  const brand = state ? (item && state.brands.find((b) => b.id === item.brandId)) || activeBrand(state) : null;
  const form = item ? { title: item.title, contentType: item.contentType, text: item.text, meta: item.meta } : local;

  const patch = (p: Partial<typeof form>) => {
    if (item) updateDraft(item.id, p);
    else setLocal((l) => ({ ...l, ...p, meta: p.meta ? { ...l.meta, ...p.meta } : l.meta }));
  };
  const patchMeta = (m: Partial<ContentMeta>) => patch({ meta: { ...form.meta, ...m } });

  const contrast = ((): { error?: string; fg?: string; bg?: string; ratio?: number } | null => {
    const fg = normalizeHex(form.meta.fg);
    const bg = normalizeHex(form.meta.bg);
    if (!form.meta.fg && !form.meta.bg) return null;
    if (!fg || !bg) return { error: "Enter both colours as hex, e.g. #1C1C1E" };
    return { fg, bg, ratio: contrastRatio(fg, bg) };
  })();

  if (!state || !brand) return <Skeleton />;
  if (itemId && !item) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-stone-600">This content item doesn’t exist in local storage (it may have been deleted or the demo was reset).</p>
        <Link href="/review" className="mt-3 inline-block text-sm text-orange-700 underline">Back to Review Content</Link>
      </Card>
    );
  }

  const aiAvailable = !!ai?.configured && ai.verified !== "no";
  const isConfidential = item ? !!item.confidential : confidentialLocal;
  const preview = redact(form.text, brand.sensitiveTerms);
  const reviewed = !!item && item.runs.length > 0;
  const docMode = mode ?? (reviewed ? "annotated" : "edit");
  const openFindings = item ? [...item.findings.filter(isOpen)].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]) : [];
  const firstOpen = openFindings[0];
  const selectedId = selected === null ? firstOpen?.id ?? null : selected === "" ? null : selected;

  const focusFinding = (id: string) => {
    setTab("findings");
    setSelected(id);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  async function run() {
    setBanner(null);
    if (!form.text.trim()) {
      setBanner({ tone: "error", text: "Add some content to review." });
      return;
    }
    if (form.text.length > MAX) {
      setBanner({ tone: "error", text: `Content is over ${MAX} characters.` });
      return;
    }
    const id = item?.id ?? createItem(local);
    if (!item && confidentialLocal) setConfidential(id, true);
    const tooLongForAi = form.text.length > AI_MAX;
    const wantAi = useAi && aiAvailable && !isConfidential && !tooLongForAi;
    const done = () => {
      setMode("annotated");
      setSelected(null);
      setTab("findings");
      if (!item) router.replace(`/review/${id}`);
    };
    if (!wantAi) {
      commitReview(id, { mode: "deterministic", aiStatus: isConfidential ? "confidential" : ai?.configured ? "not_requested" : "not_configured" });
      if (isConfidential) setBanner({ tone: "info", text: "Confidential: reviewed in this browser only. Nothing was sent to an AI service." });
      else if (tooLongForAi && useAi && aiAvailable)
        setBanner({ tone: "info", text: `This content is over ${AI_MAX.toLocaleString()} characters, so it was reviewed with rule-based checks only.` });
      else if (!ai?.configured) setBanner({ tone: "info", text: "Deterministic review complete. Live AI jurors aren’t configured on this deployment, so no AI findings were generated." });
      done();
      return;
    }
    setPendingDet(runDeterministic({ text: form.text, meta: form.meta, brand: brand! }).findings.length);
    setPhase("ai");
    // Redact before anything leaves the browser; restore placeholders in the results.
    const red = redact(form.text, brand!.sensitiveTerms);
    const altRed = redact(form.meta.altText, brand!.sensitiveTerms);
    const ledger = (outcome: "ok" | "failed", model: string, error?: string) =>
      recordAiCall({
        purpose: "content review",
        service: "Google Gemini API",
        model,
        itemTitle: form.title || "Untitled draft",
        sentPreview: red.text,
        sentChars: red.text.length + altRed.text.length,
        redactions: [...red.counts, ...altRed.counts],
        outcome,
        error,
      });
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: red.text,
          contentType: form.contentType,
          // Images, video frames and captions stay in the browser; the model sees redacted alt text and colour values.
          meta: { ...form.meta, altText: altRed.text, image: undefined, video: undefined, captions: undefined, document: undefined },
          brand: { name: brand!.name, rules: brand!.rules, facts: brand!.facts, bannedTerms: brand!.bannedTerms, preferredTerms: brand!.preferredTerms },
        }),
      });
      const data = (await res.json().catch(() => null)) as AiReviewResponse | null;
      if (data && data.ok) {
        ledger("ok", data.model);
        const findings = data.findings.map((f) => ({
          ...f,
          title: restore(f.title, red.redactions)!,
          offendingText: restore(f.offendingText, red.redactions),
          explanation: restore(f.explanation, red.redactions)!,
          suggestedFix: restore(f.suggestedFix, red.redactions)!,
          replacement: restore(f.replacement, red.redactions),
        }));
        commitReview(id, { aiFindings: findings, mode: "deterministic+ai", aiStatus: "ok", model: data.model });
        if (data.dropped > 0) setBanner({ tone: "info", text: `${data.dropped} AI finding(s) were discarded because they quoted text not in the draft or were malformed.` });
      } else {
        const msg = data && !data.ok ? data.error.message : `AI request failed (HTTP ${res.status}).`;
        ledger("failed", ai?.model ?? "unknown", msg);
        commitReview(id, { mode: "deterministic", aiStatus: "failed", aiError: msg });
        setBanner({ tone: "error", text: `Live AI review failed: ${msg} Deterministic findings are shown; no AI results were recorded.` });
      }
    } catch {
      ledger("failed", ai?.model ?? "unknown", "Network error");
      commitReview(id, { mode: "deterministic", aiStatus: "failed", aiError: "Network error" });
      setBanner({ tone: "error", text: "Could not reach the AI review service. Deterministic findings are shown; no AI results were recorded." });
    } finally {
      setPhase("idle");
      done();
    }
  }

  const loadExample = (id: string) => {
    if (!id) return;
    if (item) {
      router.push(`/review/new?example=${id}`);
      return;
    }
    const e = EXAMPLES.find((x) => x.id === id)!;
    setLocal({ title: `Demo ${e.id}: ${e.title}`, contentType: e.contentType, text: e.text, meta: { ...e.meta } });
  };

  const latest = item?.versions[item.versions.length - 1];
  const dirty = !!item && !!latest && latest.text !== item.text;
  const visualSummary = [
    form.meta.image ? "Image" : form.meta.hasImage ? "Image (no file)" : null,
    form.meta.video ? "Video" : form.meta.hasVideo ? "Video (no file)" : null,
    form.meta.captions ? "Captions" : null,
    contrast?.ratio ? `Contrast ${contrast.ratio.toFixed(2)}:1` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/review" className="text-xs font-medium text-stone-500 hover:text-stone-900">← Review Content</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            aria-label="Title"
            className="min-w-0 flex-1 rounded-md bg-transparent px-1 -mx-1 font-serif text-[2rem] leading-tight tracking-tight text-stone-950 placeholder:text-stone-300 hover:bg-stone-100/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-200"
            value={form.title}
            placeholder="Untitled draft"
            onChange={(e) => patch({ title: e.target.value })}
          />
          {item && <StatusBadge status={item.status} />}
          {item?.seeded && <Badge tone="orange">Seeded demo history</Badge>}
          {isConfidential && (
            <Badge tone="dark">
              <Lock size={11} /> Confidential
            </Badge>
          )}
          {latest && <span className="text-xs text-stone-500">v{latest.number}{dirty ? " · unsaved edits" : ""}</span>}
        </div>
        <Stepper item={item} dirty={dirty} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* LEFT — the document */}
        <div className="space-y-4 self-start xl:sticky xl:top-6">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-2.5">
              <span className="text-sm font-medium text-stone-900">Content</span>
              {reviewed && (
                <div role="radiogroup" aria-label="Document view" className="ml-2 flex rounded-lg bg-stone-100 p-0.5 text-xs">
                  {(
                    [
                      ["annotated", "Highlights", ScanText],
                      ["edit", "Edit", PenLine],
                    ] as const
                  ).map(([m, label, Icon]) => (
                    <button
                      key={m}
                      role="radio"
                      aria-checked={docMode === m}
                      onClick={() => setMode(m)}
                      className={cx("flex items-center gap-1 rounded-md px-2 py-1", docMode === m ? "bg-white font-medium text-stone-900 shadow-soft" : "text-stone-500 hover:text-stone-800")}
                    >
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>
              )}
              {docMode === "edit" && <DocumentImport onLoad={(d) => patch({ ...d, meta: { ...form.meta, ...d.meta } })} hasTitle={!!form.title} />}
              {docMode === "edit" && (
                <select aria-label="Load example" className="rounded-md border border-stone-200 bg-white px-1.5 py-1 text-xs text-stone-600" value="" onChange={(e) => loadExample(e.target.value)}>
                  <option value="">Load example…</option>
                  {EXAMPLES.map((e) => <option key={e.id} value={e.id}>{e.id}: {e.title}</option>)}
                </select>
              )}
            </div>
            {docMode === "annotated" && item ? (
              <AnnotatedText text={item.text} findings={item.findings} selectedId={selectedId} onSelect={focusFinding} />
            ) : (
              <>
                <label htmlFor="content" className="sr-only">Content to review</label>
                <textarea
                  id="content"
                  className="block min-h-[240px] w-full resize-y border-0 px-4 py-3 text-[15px] leading-relaxed text-stone-900 placeholder:text-stone-400 focus:outline-none"
                  placeholder="Paste a social post, email or marketing copy…"
                  value={form.text}
                  onChange={(e) => patch({ text: e.target.value })}
                />
              </>
            )}
            <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/60 px-4 py-2 text-[11px] text-stone-500">
              <span>
                {docMode === "annotated" ? "Click a highlight to see its finding." : dirty ? "Edits will be saved as a new version on the next review." : "Paste or write the copy you want checked."}
              </span>
              <span className={cx("tabular-nums", form.text.length > MAX && "text-red-600")}>{form.text.length.toLocaleString()} / {MAX.toLocaleString()}</span>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="brand">Brand</Label>
              <select id="brand" className={inputCls} value={brand.id} disabled={!!item || state.brands.length < 2} onChange={(e) => setActiveBrand(e.target.value)}>
                {state.brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}{b.fictional ? " (fictional)" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="ctype">Content type</Label>
              <select id="ctype" className={inputCls} value={form.contentType} onChange={(e) => patch({ contentType: e.target.value as ContentType })}>
                {CONTENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <Disclosure
            title="Media & accessibility"
            hint="Optional. Image, video, captions, alt text and colour contrast."
            defaultOpen={form.meta.hasImage || !!form.meta.hasVideo || !!form.meta.fg}
            badge={visualSummary ? <Badge tone="outline">{visualSummary}</Badge> : undefined}
          >
            <div className="space-y-4">
              <ImagePanel meta={form.meta} brand={brand} onChange={patchMeta} />
              <div className="border-t border-stone-100 pt-3">
                <VideoPanel meta={form.meta} brand={brand} onChange={patchMeta} />
              </div>
              <div className="border-t border-stone-100 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  {(["fg", "bg"] as const).map((k) => (
                    <div key={k}>
                      <Label htmlFor={k}>{k === "fg" ? "Text colour" : "Background colour"}</Label>
                      <div className="flex gap-1.5">
                        <input
                          type="color"
                          aria-label={`${k === "fg" ? "Text" : "Background"} colour picker`}
                          className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-stone-200 p-0.5"
                          value={normalizeHex(form.meta[k]) ?? (k === "fg" ? "#000000" : "#ffffff")}
                          onChange={(e) => patchMeta({ [k]: e.target.value.toUpperCase() })}
                        />
                        <input id={k} className={inputCls} value={form.meta[k]} placeholder={k === "fg" ? "#1C1C1E" : "#FFFFFF"} onChange={(e) => patchMeta({ [k]: e.target.value })} />
                      </div>
                    </div>
                  ))}
                </div>
                {contrast?.error && <p className="mt-2 text-xs text-red-700">{contrast.error}</p>}
                {contrast?.ratio !== undefined && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="rounded-md border border-stone-200 px-3 py-1.5 text-sm font-semibold" style={{ color: contrast.fg, background: contrast.bg }}>Aa sample</span>
                    <span className="text-xs text-stone-700">
                      Contrast <strong className="tabular-nums">{contrast.ratio.toFixed(2)}:1</strong> ·{" "}
                      {contrast.ratio >= 4.5 ? <span className="text-emerald-700">passes AA</span> : contrast.ratio >= 3 ? <span className="text-orange-700">AA large text only</span> : <span className="text-red-700">fails AA</span>}
                    </span>
                    <button className="ml-auto text-[11px] text-stone-500 underline" onClick={() => patchMeta({ fg: "", bg: "" })}>Clear</button>
                  </div>
                )}
              </div>
            </div>
          </Disclosure>

          <div className="space-y-2.5">
            <Button variant="accent" size="lg" className="w-full" onClick={run} disabled={phase === "ai"}>
              {phase === "ai" ? <Loader2 size={16} className="animate-spin" /> : <Gavel size={16} />}
              {phase === "ai" ? "Jury deliberating…" : reviewed ? (dirty ? "Re-run Jury Review on edits" : "Re-run Jury Review") : "Run Jury Review"}
            </Button>
            {phase === "ai" && (
              <p role="status" className="text-xs text-stone-600">
                Deterministic checks done ({pendingDet} finding{pendingDet === 1 ? "" : "s"}). Waiting for AI jurors…
              </p>
            )}
            <PrivacyControls
              confidential={isConfidential}
              onConfidential={(v) => (item ? setConfidential(item.id, v) : setConfidentialLocal(v))}
              aiAvailable={aiAvailable}
              useAi={useAi}
              onUseAi={setUseAi}
              ai={ai}
              preview={preview}
            />
          </div>
        </div>

        {/* RIGHT — results */}
        <div className="min-w-0">
          {banner && (
            <div role="status" className={cx("mb-4 rounded-xl border px-4 py-3 text-sm", banner.tone === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-stone-200 bg-white text-stone-700")}>
              {banner.text}
            </div>
          )}
          {!item || !reviewed ? (
            <EmptyResults />
          ) : (
            <>
              <Verdict item={item} onResolve={focusFinding} onApproval={() => setTab("approval")} />
              <div className="mt-6">
                <Tabs
                  label="Review details"
                  value={tab}
                  onChange={setTab}
                  tabs={[
                    { id: "findings", label: <>Findings <span className="ml-1 rounded-full bg-stone-100 px-1.5 text-[11px] text-stone-600">{openFindings.length} open</span></> },
                    { id: "approval", label: "Approval" },
                    { id: "versions", label: `Versions (${item.versions.length})` },
                    {
                      id: "discussion",
                      label: (
                        <>
                          Discussion
                          {(item.comments ?? []).filter((c) => !c.resolved).length > 0 && (
                            <span className="ml-1 rounded-full bg-orange-600 px-1.5 text-[11px] text-white">{(item.comments ?? []).filter((c) => !c.resolved).length}</span>
                          )}
                        </>
                      ),
                    },
                    { id: "activity", label: "Activity" },
                  ]}
                />
              </div>
              <div className="pt-5" role="tabpanel">
                {tab === "findings" && (
                  <FindingsView item={item} selectedId={selectedId} onToggle={(id) => setSelected(selectedId === id ? "" : id)} tourId={firstOpen?.id} />
                )}
                {tab === "versions" && <VersionsPanel item={item} />}
                {tab === "approval" && <ApprovalPanel item={item} role={state.role} onRerun={run} />}
                {tab === "discussion" && <Discussion item={item} onOpenFinding={focusFinding} />}
                {tab === "activity" && (
                  <ol className="relative space-y-3 border-l border-stone-200 pl-4">
                    {[...item.events].reverse().map((e, i) => (
                      <li key={i} className="text-xs text-stone-700">
                        <span className="absolute -left-[4.5px] mt-1 h-2 w-2 rounded-full bg-stone-300" aria-hidden />
                        <span className="text-stone-400">{fmtDate(e.at)}</span> · <span className="font-medium text-stone-900">{e.by}</span>
                        <span className="block text-stone-600">{e.text}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ item, dirty }: { item?: ContentItem; dirty: boolean }) {
  const reviewed = !!item && item.runs.length > 0 && !dirty && item.runs[item.runs.length - 1].versionNumber === item.versions[item.versions.length - 1].number;
  const blockers = item ? unresolvedHighRisk(item).length : 0;
  const steps = [
    { label: "Draft", sub: item ? `v${item.versions[item.versions.length - 1].number}` : "Write or paste copy", done: !!item },
    { label: "Jury review", sub: reviewed ? `${item!.runs.length} run${item!.runs.length > 1 ? "s" : ""}` : dirty ? "Re-run on edits" : "Not run yet", done: reviewed },
    { label: "Resolve", sub: !item?.runs.length ? "—" : blockers ? `${blockers} high-risk open` : "No blockers", done: !!item?.runs.length && blockers === 0 },
    {
      label: "Approval",
      sub: item?.status === "approved" ? "Approved" : item?.status === "under_review" ? "Awaiting reviewer" : item?.status === "changes_requested" ? "Changes requested" : "Not submitted",
      done: item?.status === "approved",
    },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol data-tour="stepper" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Workflow progress">
      {steps.map((s, i) => {
        const state = s.done ? "done" : i === current ? "current" : "todo";
        return (
          <li
            key={s.label}
            aria-current={state === "current" ? "step" : undefined}
            className={cx(
              "flex items-center gap-2.5 rounded-xl border px-3 py-2",
              state === "current" ? "border-stone-900 bg-white shadow-soft" : state === "done" ? "border-stone-200/80 bg-white/60" : "border-dashed border-stone-300",
            )}
          >
            <span
              className={cx(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                state === "done" ? "bg-emerald-600 text-white" : state === "current" ? "bg-stone-900 text-white" : "bg-stone-200 text-stone-500",
              )}
            >
              {state === "done" ? <Check size={13} /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-stone-900">{s.label}</span>
              <span className={cx("block truncate text-[11px]", s.label === "Resolve" && blockers ? "text-red-700" : "text-stone-500")}>{s.sub}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function AnnotatedText({ text, findings, selectedId, onSelect }: { text: string; findings: Finding[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const lower = text.toLowerCase();
  const ranges: { start: number; end: number; f: Finding }[] = [];
  for (const f of [...findings.filter(isOpen)].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity])) {
    if (!f.offendingText || f.location) continue;
    const start = lower.indexOf(f.offendingText.toLowerCase());
    if (start < 0) continue;
    const end = start + f.offendingText.length;
    if (ranges.some((r) => start < r.end && end > r.start)) continue;
    ranges.push({ start, end, f });
  }
  ranges.sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  ranges.forEach((r, i) => {
    if (r.start > pos) parts.push(text.slice(pos, r.start));
    const sev = r.f.severity;
    parts.push(
      <button
        key={i}
        onClick={() => onSelect(r.f.id)}
        aria-label={`${sev} risk: ${r.f.title}. Show finding.`}
        className={cx(
          "rounded-[3px] px-0.5 text-left underline decoration-2 underline-offset-[3px] transition-colors",
          sev === "high" ? "bg-red-100/70 decoration-red-500 hover:bg-red-100" : sev === "medium" ? "bg-orange-100/70 decoration-orange-500 hover:bg-orange-100" : "bg-stone-200/60 decoration-stone-400 hover:bg-stone-200",
          selectedId === r.f.id && "ring-2 ring-stone-900/70",
        )}
      >
        {text.slice(r.start, r.end)}
      </button>,
    );
    pos = r.end;
  });
  if (pos < text.length) parts.push(text.slice(pos));
  // Findings about images or colours have no text to highlight; overlapping quotes share one highlight.
  const unplaced = findings.filter((f) => isOpen(f) && (!!f.location || !f.offendingText || !lower.includes(f.offendingText.toLowerCase()))).length;
  return (
    <div data-tour="document" className="px-4 py-4">
      <p className="whitespace-pre-wrap text-[15px] leading-[1.8] text-stone-900">{parts}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-stone-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> High</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> Medium</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-stone-400" /> Low</span>
        {unplaced > 0 && <span>· {unplaced} more finding{unplaced > 1 ? "s" : ""} about media, captions or colour</span>}
      </div>
    </div>
  );
}

function EmptyResults() {
  return (
    <Card className="p-8">
      <IconChip tone="ink"><Gavel size={16} /></IconChip>
      <h3 className="mt-4 font-serif text-2xl text-stone-950">Ready when you are</h3>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-stone-600">
        Run the jury to check this draft. Rule-based checks (banned terms, approved facts, numbers, alt text, contrast) run instantly. AI jurors add judgement when
        they’re configured.
      </p>
      <ul className="mt-5 grid grid-cols-2 gap-2 text-xs text-stone-700">
        {JURORS.map((j) => (
          <li key={j} className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">{j}</li>
        ))}
      </ul>
    </Card>
  );
}

function Verdict({ item, onResolve, onApproval }: { item: ContentItem; onResolve: (id: string) => void; onApproval: () => void }) {
  const open = item.findings.filter(isOpen);
  const c = { high: 0, medium: 0, low: 0 };
  open.forEach((f) => c[f.severity]++);
  const blocker = unresolvedHighRisk(item)[0];
  const v =
    c.high > 0
      ? { label: "Blocked", sub: `${c.high} high-risk finding${c.high > 1 ? "s" : ""} must be fixed, dismissed with a reason, or overridden by a reviewer.`, icon: CircleSlash, cls: "border-red-200 bg-red-50/70", ic: "text-red-600" }
      : open.length > 0
        ? { label: "Needs attention", sub: "No blockers. Lower-risk findings are still open.", icon: AlertTriangle, cls: "border-orange-200 bg-orange-50/70", ic: "text-orange-600" }
        : { label: "Ready for approval", sub: "Every finding is resolved.", icon: CheckCircle2, cls: "border-emerald-200 bg-emerald-50/70", ic: "text-emerald-600" };
  const r = item.runs[item.runs.length - 1];
  const runLabel =
    r.mode === "seeded"
      ? item.seeded
        ? "Seeded demo history"
        : "Rule-based checks (live) + seeded demo jury results (precomputed, not a live AI call)"
      : r.aiStatus === "ok"
        ? `Rule-based checks + live AI jurors (${r.model})`
        : r.aiStatus === "failed"
          ? `Rule-based checks only — AI failed: ${r.aiError}`
          : r.aiStatus === "confidential"
            ? "Rule-based checks only — confidential, nothing sent to AI"
            : r.aiStatus === "not_configured"
            ? "Rule-based checks only — live AI not configured"
            : "Rule-based checks only";
  const RunIcon = r.mode === "seeded" ? FlaskConical : r.aiStatus === "ok" ? Sparkles : Wand2;

  return (
    <div data-tour="verdict" className={cx("rounded-2xl border p-5", v.cls)}>
      <div className="flex flex-wrap items-start gap-3">
        <v.icon size={22} className={cx("mt-0.5", v.ic)} />
        <div className="min-w-0 flex-1">
          <div className="font-serif text-2xl leading-tight text-stone-950">{v.label}</div>
          <p className="mt-0.5 text-sm text-stone-700">{v.sub}</p>
        </div>
        {blocker ? (
          <Button size="sm" variant="primary" onClick={() => onResolve(blocker.id)}>
            Resolve next <ArrowRight size={13} />
          </Button>
        ) : item.status !== "approved" ? (
          <Button size="sm" variant="primary" onClick={onApproval}>
            {item.status === "under_review" ? "View approval" : "Go to approval"} <ArrowRight size={13} />
          </Button>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["High", c.high, "bg-red-500"],
            ["Medium", c.medium, "bg-orange-500"],
            ["Low", c.low, "bg-stone-400"],
            ["Resolved", item.findings.length - open.length, "bg-emerald-500"],
          ] as const
        ).map(([l, n, dot]) => (
          <span key={l} className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white/80 px-2.5 py-1 text-xs text-stone-700">
            <span className={cx("h-1.5 w-1.5 rounded-full", dot)} />
            <strong className="tabular-nums text-stone-950">{n}</strong> {l}
          </span>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-600">
        <RunIcon size={12} /> v{r.versionNumber} · {fmtDate(r.at)} · {runLabel}
        {r.notices?.map((n) => (
          <span key={n} className="block w-full text-orange-800">{n}</span>
        ))}
      </p>
    </div>
  );
}

function FindingsView({ item, selectedId, onToggle, tourId }: { item: ContentItem; selectedId: string | null; onToggle: (id: string) => void; tourId?: string }) {
  const state = useAppState()!;
  const brand = state.brands.find((b) => b.id === item.brandId) ?? activeBrand(state);
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const visible = item.findings.filter((f) => (filter === "all" ? true : filter === "open" ? isOpen(f) : !isOpen(f)));
  const groups = [
    { key: "det", title: "Rule-based checks", note: "Deterministic and reproducible. Exact matching is not full semantic verification.", list: visible.filter((f) => f.source === "deterministic") },
    { key: "ai", title: "AI-assisted jury", note: "Live model judgements. Evidence IDs re-checked against the brand library.", list: visible.filter((f) => f.source === "ai") },
    { key: "seeded", title: "Seeded demo results", note: "Precomputed examples of AI juror output. Not a live AI call.", list: visible.filter((f) => f.source === "seeded") },
  ].filter((g) => g.list.length > 0);
  const counts = { open: item.findings.filter(isOpen).length, resolved: item.findings.filter((f) => !isOpen(f)).length, all: item.findings.length };

  return (
    <div className="space-y-6">
      <div className="flex gap-1.5" role="radiogroup" aria-label="Filter findings">
        {(["open", "resolved", "all"] as const).map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={filter === k}
            onClick={() => setFilter(k)}
            className={cx("rounded-full px-3 py-1 text-xs capitalize transition-colors", filter === k ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stone-300")}
          >
            {k} <span className="opacity-60">{counts[k]}</span>
          </button>
        ))}
      </div>
      {groups.length === 0 && (
        <Card className="flex items-center gap-3 p-5 text-sm text-stone-600">
          <IconChip tone="green"><CheckCircle2 size={15} /></IconChip>
          {filter === "open" ? "No open findings. Head to Approval when you’re ready." : "Nothing here yet."}
        </Card>
      )}
      {groups.map((g) => (
        <section key={g.key} aria-label={g.title}>
          <SectionTitle aside={<span className="text-[11px] text-stone-400">{g.note}</span>}>{g.title}</SectionTitle>
          <div className="space-y-4">
            {JURORS.map((j: Juror) => {
              const list = g.list.filter((f) => f.juror === j).sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);
              if (!list.length) return null;
              return (
                <div key={j}>
                  <div className="mb-1.5 text-xs font-medium text-stone-500">
                    {j} <span className="text-stone-400">· {list.length}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((f) => (
                      <FindingCard
                        key={f.id}
                        itemId={item.id}
                        finding={f}
                        brand={brand}
                        text={item.text}
                        open={selectedId === f.id}
                        onToggle={() => onToggle(f.id)}
                        tour={f.id === tourId}
                        readOnly={item.seeded}
                        comments={item.comments}
                        page={pageOfQuote(item.meta.document, item.text, f.offendingText)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {item.matchedFacts.length > 0 && filter !== "resolved" && (
        <section>
          <SectionTitle>Supported by approved facts</SectionTitle>
          <ul className="space-y-2">
            {item.matchedFacts.map((m, i) => {
              const fact = brand.facts.find((f) => f.id === m.factId);
              return (
                <li key={i} className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span>
                    <span className="block text-xs font-semibold text-emerald-900">
                      {m.factId === "LOGO" ? "Reference logo · whole-file match" : `${m.factId} · ${m.kind === "exact" ? "exact wording" : "key figures match"}`}
                    </span>
                    <span className="block text-stone-800">“{m.text}”</span>
                    {fact && <span className="block text-[11px] text-stone-600">Approved: “{fact.statement}”</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-stone-500">String matching shows the figures appear in an approved fact. It doesn’t prove the sentence around them isn’t misleading.</p>
        </section>
      )}
    </div>
  );
}

function Discussion({ item, onOpenFinding }: { item: ContentItem; onOpenFinding: (id: string) => void }) {
  const findingThreads = [...new Set((item.comments ?? []).filter((c) => c.findingId).map((c) => c.findingId!))];
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>Discussion about this content</SectionTitle>
        <CommentThread itemId={item.id} comments={item.comments ?? []} />
      </section>
      {findingThreads.length > 0 && (
        <section>
          <SectionTitle>Threads on findings</SectionTitle>
          <ul className="space-y-1.5">
            {findingThreads.map((fid) => {
              const f = item.findings.find((x) => x.id === fid);
              const open = (item.comments ?? []).filter((c) => c.findingId === fid && !c.resolved).length;
              return (
                <li key={fid}>
                  <button onClick={() => onOpenFinding(fid)} className="flex w-full items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm hover:border-stone-300">
                    <span className="font-mono text-xs text-stone-500">{fid}</span>
                    <span className="flex-1 truncate text-stone-800">{f?.title ?? "Finding"}</span>
                    <span className="text-xs text-stone-500">{open} open</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function PrivacyControls({
  confidential,
  onConfidential,
  aiAvailable,
  useAi,
  onUseAi,
  ai,
  preview,
}: {
  confidential: boolean;
  onConfidential: (v: boolean) => void;
  aiAvailable: boolean;
  useAi: boolean;
  onUseAi: (v: boolean) => void;
  ai: ReturnType<typeof useAiStatus>;
  preview: ReturnType<typeof redact>;
}) {
  const [show, setShow] = useState(false);
  const aiOn = useAi && aiAvailable && !confidential;
  return (
    <div className="space-y-2 rounded-xl border border-stone-200/80 bg-white p-3 shadow-soft">
      <label className="flex items-start gap-2 text-xs text-stone-700">
        <input type="checkbox" className="mt-0.5" checked={confidential} onChange={(e) => onConfidential(e.target.checked)} />
        <span>
          <span className="flex items-center gap-1 font-medium text-stone-900">
            <Lock size={12} /> Confidential
          </span>
          <span className="block text-[11px] text-stone-500">Stays in this browser. Rule-based checks only; AI review is blocked.</span>
        </span>
      </label>
      <label className={cx("flex items-start gap-2 text-xs", aiAvailable && !confidential ? "text-stone-700" : "text-stone-400")}>
        <input type="checkbox" className="mt-0.5" disabled={!aiAvailable || confidential} checked={aiOn} onChange={(e) => onUseAi(e.target.checked)} />
        <span>
          <span className="flex items-center gap-1 font-medium">
            <Sparkles size={12} /> Include live AI jurors {ai?.configured ? `(Gemini · ${ai.model})` : ""}
          </span>
          <span className="block text-[11px] text-stone-500">
            {confidential
              ? "Disabled because this content is confidential."
              : !ai
                ? "Checking AI configuration…"
                : !ai.configured
                  ? "Not configured here. Rule-based checks still run."
                  : ai.verified === "no"
                    ? ai.message
                    : "Redacted text is sent to Google’s Gemini API and logged in Settings → AI disclosure ledger."}
          </span>
        </span>
      </label>
      {!confidential && (
        <div>
          <button className="text-[11px] text-orange-700 underline" onClick={() => setShow(!show)}>
            {show ? "Hide" : "Preview"} exactly what {aiOn ? "will be" : "would be"} sent to AI
            {preview.counts.length > 0 && ` (${preview.counts.reduce((n, c) => n + c.count, 0)} redaction${preview.counts.reduce((n, c) => n + c.count, 0) > 1 ? "s" : ""})`}
          </button>
          {show && (
            <div className="mt-1.5 rounded-lg border border-stone-200 bg-stone-50 p-2">
              <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-stone-700">{preview.text || "(empty)"}</p>
              <p className="mt-1 text-[10px] text-stone-500">
                {preview.counts.length ? preview.counts.map((c) => `${c.count} ${c.kind}`).join(" · ") : "No emails, phone numbers, card numbers, secrets or confidential terms found."} Brand rules and
                approved facts are also sent so findings can cite them. Images, video frames and captions are never sent.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentImport({ onLoad, hasTitle }: { onLoad: (p: { text: string; title?: string; contentType: ContentType; meta: Partial<ContentMeta> }) => void; hasTitle: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const doc = await extractDocument(file);
      const { text, ranges } = joinPages(doc.pages);
      onLoad({
        text,
        contentType: "Document",
        ...(hasTitle ? {} : { title: file.name.replace(/\.[^.]+$/, "") }),
        meta: { document: { fileName: doc.fileName, kind: doc.kind, bytes: doc.bytes, pages: ranges } },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the document.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="ml-auto flex items-center gap-1.5">
      {error && <span className="max-w-[12rem] truncate text-[11px] text-red-700" title={error}>{error}</span>}
      <button
        onClick={() => input.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-1.5 py-1 text-xs text-stone-600 hover:bg-stone-50"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} Import document
      </button>
      <button
        onClick={async () => {
          const res = await fetch("/demo/northstar-sell-sheet.pdf");
          if (res.ok) load(new File([await res.blob()], "northstar-sell-sheet.pdf", { type: "application/pdf" }));
        }}
        disabled={busy}
        className="rounded-md px-1.5 py-1 text-xs text-orange-700 hover:bg-orange-50"
        title="Load a fictional two-page sell sheet"
      >
        Sample
      </button>
      <input
        ref={input}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) load(f);
          e.target.value = "";
        }}
      />
    </span>
  );
}
