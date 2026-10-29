"use client";

import { Eye, GitCompare, PenLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Skeleton, cx } from "@/components/ui";
import { DecisionBar } from "./DecisionBar";
import { ReviewPanel, type PanelTab } from "./ReviewPanel";
import { ContentPreview } from "./Preview";
import { EditorPanel, MAX_CHARS } from "./EditorPanel";
import { VersionsPanel } from "./VersionsPanel";
import { activeBrand, commitReview, createItem, recordAiCall, setConfidential, updateDraft, useAppState } from "@/lib/store";
import { useAiStatus } from "@/lib/useAiStatus";
import { runDeterministic } from "@/lib/engine/deterministic";
import { redact, restore } from "@/lib/privacy/redact";
import { EXAMPLES } from "@/lib/seed/examples";
import type { AiReviewResponse, ContentMeta, ContentType, Finding, Severity } from "@/lib/types";

/** The AI route accepts up to 8,000 characters; longer documents get rule-based checks only. */
const AI_MAX = 8000;
/** How long the writer waits for the AI before the review finishes with rule-based checks (the server stops at 18 s). */
const AI_WAIT_MS = 20_000;
const EMPTY_META: ContentMeta = { hasImage: false, altText: "", fg: "", bg: "" };
const SEV_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const isOpen = (f: Finding) => f.status === "open" || f.status === "escalated";
type Mode = "preview" | "edit" | "compare";

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
  const [running, setRunning] = useState(false);
  const [pendingDet, setPendingDet] = useState(0);
  const [banner, setBanner] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("findings");
  const [mode, setMode] = useState<Mode | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confidentialLocal, setConfidentialLocal] = useState(false);

  const item = state && itemId ? state.items.find((i) => i.id === itemId) : undefined;
  // An existing item is always reviewed against its own workspace.
  const brand = state ? (item && state.brands.find((b) => b.id === item.brandId)) || activeBrand(state) : null;
  const form = item ? { title: item.title, contentType: item.contentType, text: item.text, meta: item.meta } : local;

  const patch = (p: Partial<typeof form>) => {
    if (item) updateDraft(item.id, p);
    else setLocal((l) => ({ ...l, ...p, meta: p.meta ? { ...l.meta, ...p.meta } : l.meta }));
  };

  if (!state || !brand) return <Skeleton />;
  if (itemId && !item) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-stone-600">This content doesn’t exist in this browser. It may have been deleted or the demo was reset.</p>
        <Link href="/content" className="mt-3 inline-block text-sm text-accent-700 hover:underline">Back to Content</Link>
      </div>
    );
  }

  const aiAvailable = !!ai?.configured && ai.verified !== "no";
  const isConfidential = item ? !!item.confidential : confidentialLocal;
  const reviewed = !!item && item.runs.length > 0;
  const latest = item?.versions[item.versions.length - 1];
  const dirty = !!item && !!latest && latest.text !== item.text;
  const reviewedCurrent = !!item && !!latest && !dirty && item.runs.some((r) => r.versionNumber === latest.number);
  const view: Mode = mode ?? (reviewed ? "preview" : "edit");
  const firstOpen = item ? [...item.findings.filter(isOpen)].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity])[0] : undefined;
  const selectedId = selected === null ? firstOpen?.id ?? null : selected === "" ? null : selected;

  /** Selecting a finding shows it in the panel and highlights its text in the preview. */
  const focusFinding = (id: string) => {
    setPanelTab("findings");
    setSelected(id);
    if (view !== "preview") setMode("preview");
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  async function run() {
    setBanner(null);
    if (!form.text.trim()) {
      setBanner({ tone: "error", text: "Add some content to review." });
      setMode("edit");
      return;
    }
    if (form.text.length > MAX_CHARS) {
      setBanner({ tone: "error", text: `Content is over ${MAX_CHARS.toLocaleString()} characters.` });
      return;
    }
    const id = item?.id ?? createItem(local);
    if (!item && confidentialLocal) setConfidential(id, true);
    const tooLongForAi = form.text.length > AI_MAX;
    const wantAi = useAi && aiAvailable && !isConfidential && !tooLongForAi;
    const done = () => {
      setMode("preview");
      setSelected(null);
      setPanelTab("findings");
      if (!item) router.replace(`/content/${id}`);
    };
    if (!wantAi) {
      commitReview(id, { mode: "deterministic", aiStatus: isConfidential ? "confidential" : ai?.configured ? "not_requested" : "not_configured" });
      if (isConfidential) setBanner({ tone: "info", text: "Confidential: reviewed in this browser only. Nothing was sent to an AI service." });
      else if (tooLongForAi && useAi && aiAvailable) setBanner({ tone: "info", text: `Over ${AI_MAX.toLocaleString()} characters, so only rule-based checks ran.` });
      done();
      return;
    }
    setPendingDet(runDeterministic({ text: form.text, meta: form.meta, brand: brand! }).findings.length);
    setRunning(true);
    // Redact before anything leaves the browser; restore placeholders in the results.
    const red = redact(form.text, brand!.sensitiveTerms);
    const altRed = redact(form.meta.altText, brand!.sensitiveTerms);
    const ledger = (outcome: "ok" | "failed", model: string, error?: string, service?: string) =>
      recordAiCall({
        purpose: "content review",
        service: service ?? ai?.service ?? "AI provider",
        model,
        itemTitle: form.title || "Untitled draft",
        sentPreview: red.text,
        sentChars: red.text.length + altRed.text.length,
        redactions: [...red.counts, ...altRed.counts],
        outcome,
        error,
      });
    // The writer is waiting: if the AI is slow or unavailable, finish with the
    // rule-based findings instead of showing an error. The run is labelled
    // "Rule-based checks", so nothing claims the AI ran; the AI log keeps the details.
    const quietFallback = (reason: string, model = ai?.model ?? "unknown") => {
      ledger("failed", model, reason);
      commitReview(id, { mode: "deterministic", aiStatus: "skipped" });
    };
    const timer = new AbortController();
    const stop = setTimeout(() => timer.abort(), AI_WAIT_MS);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        signal: timer.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: red.text,
          contentType: form.contentType,
          // Images, video frames, captions and documents stay in the browser.
          meta: { ...form.meta, altText: altRed.text, image: undefined, video: undefined, captions: undefined, document: undefined },
          brand: { name: brand!.name, rules: brand!.rules, facts: brand!.facts, bannedTerms: brand!.bannedTerms, preferredTerms: brand!.preferredTerms },
        }),
      });
      const data = (await res.json().catch(() => null)) as AiReviewResponse | null;
      if (data && data.ok) {
        // A failed first attempt was still a request to that provider: log it too.
        if (data.fallbackFrom) ledger("failed", data.fallbackFrom.model, data.fallbackFrom.error, data.fallbackFrom.service);
        ledger("ok", data.model, undefined, data.service);
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
        quietFallback(data && !data.ok ? data.error.message : `AI request failed (HTTP ${res.status}).`);
      }
    } catch {
      quietFallback(timer.signal.aborted ? `No answer within ${AI_WAIT_MS / 1000} seconds` : "Network error");
    } finally {
      clearTimeout(stop);
      setRunning(false);
      done();
    }
  }

  const loadExample = (id: string) => {
    if (!id) return;
    if (item) {
      router.push(`/content/new?example=${id}`);
      return;
    }
    const e = EXAMPLES.find((x) => x.id === id)!;
    setLocal({ title: `Demo ${e.id}: ${e.title}`, contentType: e.contentType, text: e.text, meta: { ...e.meta } });
  };

  const modes: { id: Mode; label: string; icon: typeof Eye; show: boolean }[] = [
    { id: "preview", label: "Preview", icon: Eye, show: true },
    { id: "edit", label: "Edit", icon: PenLine, show: true },
    { id: "compare", label: `Versions${item ? ` (${item.versions.length})` : ""}`, icon: GitCompare, show: !!item },
  ];

  return (
    <div>
      <DecisionBar
        item={item}
        title={form.title}
        onTitle={(t) => patch({ title: t })}
        role={state.role}
        confidential={isConfidential}
        reviewedCurrent={reviewedCurrent}
        dirty={dirty}
        running={running}
        onRun={run}
      />
      {banner && (
        <div role="status" className={cx("mt-3 rounded-md px-3 py-2 text-[13px]", banner.tone === "error" ? "bg-red-50 text-red-800" : "bg-stone-100 text-stone-700")}>
          {banner.text}
        </div>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <section aria-label="Content" className="min-w-0">
          <div className="mb-4 flex gap-1" role="tablist" aria-label="Content view">
            {modes
              .filter((m) => m.show)
              .map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={view === m.id}
                  onClick={() => setMode(m.id)}
                  className={cx(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] transition-colors duration-150",
                    view === m.id ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100",
                  )}
                >
                  <m.icon size={13} /> {m.label}
                </button>
              ))}
          </div>
          <div key={view} className="animate-fade-up">
            {view === "preview" && (
              <div data-tour="document">
                <ContentPreview item={item} form={form} brand={brand} selectedId={selectedId} onSelect={focusFinding} />
                {reviewed && <p className="mt-3 text-center text-[11px] text-stone-500">Underlined text has a finding. Select it to see the evidence.</p>}
              </div>
            )}
            {view === "edit" && (
              <EditorPanel
                form={form}
                patch={patch}
                brand={brand}
                existing={!!item}
                dirty={dirty}
                confidential={isConfidential}
                onConfidential={(v) => (item ? setConfidential(item.id, v) : setConfidentialLocal(v))}
                aiAvailable={aiAvailable}
                useAi={useAi}
                onUseAi={setUseAi}
                ai={ai}
                onLoadExample={loadExample}
              />
            )}
            {view === "compare" && item && <VersionsPanel item={item} />}
          </div>
        </section>

        <aside aria-label="Review" className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:border-l lg:border-stone-200 lg:pl-6">
          <ReviewPanel
            item={item}
            tab={panelTab}
            onTab={setPanelTab}
            selectedId={selectedId}
            onToggle={(id) => setSelected(selectedId === id ? "" : id)}
            onResolve={focusFinding}
            running={running}
            pending={pendingDet}
          />
        </aside>
      </div>
    </div>
  );
}
