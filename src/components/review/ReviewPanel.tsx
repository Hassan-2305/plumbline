"use client";

import { AlertTriangle, CheckCircle2, CircleDot, CircleSlash, Loader2 } from "lucide-react";
import { useState } from "react";
import { Tabs, cx, fmtDate } from "@/components/ui";
import { FindingCard } from "./FindingCard";
import { CommentThread } from "./CommentThread";
import { activeBrand, unresolvedHighRisk, useAppState } from "@/lib/store";
import { pageOfQuote } from "@/lib/import/pages";
import type { ContentItem, Finding, Juror, Severity } from "@/lib/types";
import { JURORS } from "@/lib/types";

const SEV_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const isOpen = (f: Finding) => f.status === "open" || f.status === "escalated";
export type PanelTab = "findings" | "discussion" | "history";

function Summary({ item, onResolve }: { item: ContentItem; onResolve: (id: string) => void }) {
  const open = item.findings.filter(isOpen);
  const c = { high: 0, medium: 0, low: 0 };
  open.forEach((f) => c[f.severity]++);
  const blocker = unresolvedHighRisk(item)[0];
  const r = item.runs[item.runs.length - 1];
  const v =
    c.high > 0
      ? { label: "Blocked", sub: `${c.high} high-risk finding${c.high > 1 ? "s" : ""} must be fixed, dismissed or overridden`, icon: CircleSlash, cls: "text-red-700" }
      : open.length > 0
        ? { label: "Needs attention", sub: "No blockers; lower-risk findings are open", icon: AlertTriangle, cls: "text-amber-700" }
        : { label: "Clear", sub: "Every finding is resolved", icon: CheckCircle2, cls: "text-emerald-700" };
  const runLabel =
    r.mode === "seeded"
      ? item.seeded
        ? "Seeded demo history"
        : "Rule-based checks + seeded demo jury results (not a live AI call)"
      : r.aiStatus === "ok"
        ? `Rule-based checks + AI jurors (${r.model})`
        : r.aiStatus === "failed"
          ? `Rule-based checks only. AI failed: ${r.aiError}`
          : r.aiStatus === "confidential"
            ? "Rule-based checks only. Confidential, nothing sent to AI"
            : r.aiStatus === "not_configured"
              ? "Rule-based checks only. AI not configured"
              : "Rule-based checks only";
  return (
    <div data-tour="verdict" className="border-b border-stone-200 pb-3">
      <div className="flex items-start gap-2">
        <v.icon size={16} className={cx("mt-0.5", v.cls)} />
        <div className="min-w-0 flex-1">
          <div className={cx("text-[13px] font-semibold", v.cls)}>{v.label}</div>
          <div className="text-xs text-stone-500">{v.sub}</div>
        </div>
        {blocker && (
          <button onClick={() => onResolve(blocker.id)} className="text-xs font-medium text-accent-700 hover:underline">
            Resolve next
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone-600">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-600" /> {c.high} high</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {c.medium} medium</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-stone-400" /> {c.low} low</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {item.findings.length - open.length} resolved</span>
      </div>
      <p className="mt-1.5 text-[11px] text-stone-500">
        v{r.versionNumber} · {fmtDate(r.at)} · {runLabel}
      </p>
      {r.notices?.map((n) => (
        <p key={n} className="mt-1 text-[11px] text-amber-800">{n}</p>
      ))}
    </div>
  );
}

function FindingsList({ item, selectedId, onToggle, tourId }: { item: ContentItem; selectedId: string | null; onToggle: (id: string) => void; tourId?: string }) {
  const state = useAppState()!;
  const brand = state.brands.find((b) => b.id === item.brandId) ?? activeBrand(state);
  const [filter, setFilter] = useState<"open" | "resolved">("open");
  const visible = item.findings.filter((f) => (filter === "open" ? isOpen(f) : !isOpen(f)));
  const counts = { open: item.findings.filter(isOpen).length, resolved: item.findings.filter((f) => !isOpen(f)).length };

  return (
    <div>
      <div className="mb-2 flex gap-1" role="radiogroup" aria-label="Filter findings">
        {(["open", "resolved"] as const).map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={filter === k}
            onClick={() => setFilter(k)}
            className={cx("rounded px-2 py-0.5 text-xs capitalize transition-colors", filter === k ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100")}
          >
            {k} <span className="tabular-nums opacity-60">{counts[k]}</span>
          </button>
        ))}
      </div>
      {visible.length === 0 && (
        <p className="py-6 text-center text-[13px] text-stone-500">{filter === "open" ? "No open findings." : "Nothing resolved yet."}</p>
      )}
      {JURORS.map((j: Juror) => {
        const list = visible.filter((f) => f.juror === j).sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);
        if (!list.length) return null;
        return (
          <section key={j} aria-label={j} className="mt-3">
            <h3 className="mb-1 flex items-center justify-between text-[11px] font-medium text-stone-500">
              {j} <span className="tabular-nums">{list.length}</span>
            </h3>
            <div className="border-t border-stone-200">
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
          </section>
        );
      })}
      {item.matchedFacts.length > 0 && filter === "open" && (
        <section className="mt-5">
          <h3 className="mb-1 text-[11px] font-medium text-stone-500">Backed by approved facts</h3>
          <ul className="divide-y divide-stone-200 border-y border-stone-200">
            {item.matchedFacts.map((m, i) => {
              const fact = brand.facts.find((f) => f.id === m.factId);
              return (
                <li key={i} className="flex gap-2 py-2 text-xs">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span className="min-w-0">
                    <span className="font-medium text-stone-800">{m.factId === "LOGO" ? "Reference logo" : m.factId}</span>{" "}
                    <span className="text-stone-600">“{m.text}”</span>
                    {fact && <span className="block text-stone-500">Approved: {fact.statement}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-[11px] text-stone-500">Matching figures doesn’t prove the surrounding sentence isn’t misleading.</p>
        </section>
      )}
    </div>
  );
}

function History({ item }: { item: ContentItem }) {
  return (
    <div className="space-y-5">
      {item.approvals.length > 0 && (
        <section>
          <h3 className="mb-1 text-[11px] font-medium text-stone-500">Decisions</h3>
          <ul className="space-y-2">
            {[...item.approvals].reverse().map((a, i) => (
              <li key={i} className="flex gap-2 text-xs text-stone-700">
                <CircleDot size={12} className={cx("mt-0.5 shrink-0", a.decision === "approved" ? "text-emerald-600" : "text-amber-600")} />
                <span>
                  <strong className="font-medium">{a.decision === "approved" ? "Approved" : "Changes requested"}</strong> v{a.versionNumber} by {a.reviewer} · {fmtDate(a.at)}
                  {a.note && <span className="block text-stone-500">“{a.note}”</span>}
                  {a.overriddenFindingIds.length > 0 && <span className="block text-red-700">Overrode {a.overriddenFindingIds.join(", ")}: “{a.overrideReason}”</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 className="mb-1 text-[11px] font-medium text-stone-500">Activity</h3>
        <ol className="space-y-2">
          {[...item.events].reverse().map((e, i) => (
            <li key={i} className="text-xs leading-snug">
              <span className="font-medium text-stone-800">{e.by.replace(/\s*\(.*\)/, "")}</span> <span className="text-stone-600">{e.text}</span>
              <span className="block text-[11px] text-stone-400">{fmtDate(e.at)}</span>
            </li>
          ))}
        </ol>
      </section>
      <p className="text-[11px] text-stone-500">Stored in this browser. Not a tamper-proof audit trail.</p>
    </div>
  );
}

export function ReviewPanel({
  item,
  tab,
  onTab,
  selectedId,
  onToggle,
  onResolve,
  running,
  pending,
}: {
  item?: ContentItem;
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onResolve: (id: string) => void;
  running: boolean;
  pending: number;
}) {
  if (!item || item.runs.length === 0) {
    return (
      <div className="py-2">
        <h2 className="text-[13px] font-semibold text-stone-900">Review</h2>
        <p className="mt-1 text-[13px] text-stone-500">
          Run the review to check this draft against the brand’s rules and approved facts. Rule-based checks run in your browser; AI jurors add judgement when configured.
        </p>
        <ul className="mt-4 divide-y divide-stone-200 border-y border-stone-200 text-[13px] text-stone-700">
          {JURORS.map((j) => (
            <li key={j} className="py-2">{j}</li>
          ))}
        </ul>
        {running && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-stone-600" role="status">
            <Loader2 size={12} className="animate-spin" /> Rule-based checks done ({pending}); waiting for AI jurors…
          </p>
        )}
      </div>
    );
  }
  const firstOpen = [...item.findings.filter(isOpen)].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity])[0];
  const unresolved = (item.comments ?? []).filter((c) => !c.resolved).length;
  const findingThreads = [...new Set((item.comments ?? []).filter((c) => c.findingId).map((c) => c.findingId!))];

  return (
    <div>
      <Summary item={item} onResolve={onResolve} />
      {running && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-600" role="status">
          <Loader2 size={12} className="animate-spin" /> Re-reviewing…
        </p>
      )}
      <Tabs
        className="mt-2"
        label="Review panel"
        value={tab}
        onChange={onTab}
        tabs={[
          { id: "findings", label: `Findings ${item.findings.filter(isOpen).length}` },
          { id: "discussion", label: `Discussion${unresolved ? ` ${unresolved}` : ""}` },
          { id: "history", label: "History" },
        ]}
      />
      <div className="pt-3" role="tabpanel">
        {tab === "findings" && <FindingsList item={item} selectedId={selectedId} onToggle={onToggle} tourId={firstOpen?.id} />}
        {tab === "discussion" && (
          <div className="space-y-5">
            <CommentThread itemId={item.id} comments={item.comments ?? []} />
            {findingThreads.length > 0 && (
              <section>
                <h3 className="mb-1 text-[11px] font-medium text-stone-500">Threads on findings</h3>
                <ul className="divide-y divide-stone-200 border-y border-stone-200">
                  {findingThreads.map((fid) => {
                    const f = item.findings.find((x) => x.id === fid);
                    const n = (item.comments ?? []).filter((c) => c.findingId === fid && !c.resolved).length;
                    return (
                      <li key={fid}>
                        <button onClick={() => onResolve(fid)} className="flex w-full items-center gap-2 py-2 text-left text-xs hover:bg-stone-50">
                          <span className="flex-1 truncate text-stone-800">{f?.title ?? fid}</span>
                          <span className="text-stone-500">{n} open</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
        {tab === "history" && <History item={item} />}
      </div>
    </div>
  );
}
