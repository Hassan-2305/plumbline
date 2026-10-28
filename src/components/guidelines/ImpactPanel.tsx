"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, FlaskConical, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, cx, fmtDate } from "@/components/ui";
import { activeBrand, saveImpact, useAppState } from "@/lib/store";
import { testChange, type ImpactReport } from "@/lib/engine/impact";
import type { Brand, ImpactSummary } from "@/lib/types";

const VERDICT = {
  safe: { label: "Safe to ship", cls: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: CheckCircle2 },
  review: { label: "Ships with new flags — review them", cls: "border-orange-200 bg-orange-50 text-orange-950", icon: AlertTriangle },
  risky: { label: "Risky — breaks real issues or approved content", cls: "border-red-200 bg-red-50 text-red-900", icon: ShieldAlert },
} as const;

export function ImpactBadge({ impact }: { impact?: ImpactSummary }) {
  if (!impact) return <Badge tone="outline">Not tested</Badge>;
  const tone = impact.verdict === "safe" ? "green" : impact.verdict === "review" ? "orange" : "red";
  return <Badge tone={tone}>{impact.verdict === "safe" ? "Tested · safe" : impact.verdict === "review" ? "Tested · new flags" : "Tested · risky"}</Badge>;
}

/**
 * "Test this change": replays the rule-based jury over every content item of
 * this brand under the current and proposed rules, scored against human decisions.
 */
export function ImpactPanel({ propose, target, saved, tour }: { propose: (b: Brand) => Brand; target: { conflictId?: string; changeId?: string }; saved?: ImpactSummary; tour?: boolean }) {
  const state = useAppState()!;
  const brand = activeBrand(state);
  const [report, setReport] = useState<ImpactReport | null>(null);
  const [showRows, setShowRows] = useState(false);

  const run = () => {
    const items = state.items.filter((i) => i.brandId === brand.id);
    const r = testChange(items, brand, propose(brand));
    setReport(r);
    saveImpact(target, r.summary);
  };

  const s = report?.summary;
  const v = s ? VERDICT[s.verdict] : null;

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FlaskConical size={15} className="text-stone-600" />
        <span className="text-sm font-medium text-stone-900">Test this change</span>
        <span className="text-xs text-stone-500">Replays the review history under the old and new rules before anything ships.</span>
        <Button size="sm" variant="primary" className="ml-auto" onClick={run} data-tour={tour ? "impact-test" : undefined}>
          {report ? "Re-run test" : "Run test"}
        </Button>
      </div>

      {!report && saved && (
        <p className="mt-2 text-xs text-stone-600">
          Last tested {fmtDate(saved.at)}: <ImpactBadge impact={saved} /> {saved.removedDismissed} dismissed findings removed, {saved.lostAccepted} accepted issues lost,{" "}
          {saved.added} new flags.
        </p>
      )}

      {s && v && (
        <div className="mt-3 space-y-3 animate-fade-up">
          <div className={cx("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium", v.cls)}>
            <v.icon size={16} /> {v.label}
            <span className="ml-auto text-xs font-normal opacity-80">{s.versionsTested} versions replayed</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric
              value={s.removedDismissed}
              label="Noise removed"
              hint={`of ${s.removed} findings that would disappear, reviewers had dismissed ${s.removedDismissed}`}
              tone={s.removedDismissed ? "green" : "stone"}
            />
            <Metric value={s.keptAccepted} label="Real issues still caught" hint={`${s.kept} findings unchanged; ${s.keptAccepted} were accepted as real`} tone="stone" />
            <Metric value={s.lostAccepted} label="Real issues lost" hint="Findings reviewers accepted that would no longer be raised" tone={s.lostAccepted ? "red" : "stone"} />
            <Metric
              value={s.added}
              label="New flags"
              hint={s.approvedNowFailing ? `${s.approvedNowFailing} approved item(s) would now fail` : "Findings the new rules would add"}
              tone={s.approvedNowFailing ? "red" : s.added ? "orange" : "stone"}
            />
          </div>
          {report!.rows.length > 0 && (
            <div>
              <button className="flex items-center gap-1 text-xs font-medium text-stone-700" aria-expanded={showRows} onClick={() => setShowRows(!showRows)}>
                <ChevronDown size={13} className={cx("transition-transform", showRows && "rotate-180")} /> {report!.rows.length} content item{report!.rows.length > 1 ? "s" : ""} affected
              </button>
              {showRows && (
                <ul className="mt-2 space-y-1.5">
                  {report!.rows.map((r) => (
                    <li key={r.itemId} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs">
                      <Link href={`/review/${r.itemId}`} className="font-medium text-stone-900 hover:underline">{r.title}</Link>
                      {r.seeded && <span className="text-orange-700"> · seeded</span>}
                      {r.status === "approved" && <span className="text-stone-500"> · approved</span>}
                      {r.removed.map((f, i) => (
                        <div key={`r${i}`} className="mt-0.5 text-emerald-800">
                          − {f.title}
                          {f.history && (
                            <span className="text-stone-500">
                              {" "}
                              (was {f.history}
                              {f.reason ? `: ${f.reason}` : ""})
                            </span>
                          )}
                        </div>
                      ))}
                      {r.added.map((f, i) => (
                        <div key={`a${i}`} className="mt-0.5 text-orange-800">
                          + {f.title} <span className="text-stone-500">({f.severity})</span>
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <p className="text-[11px] text-stone-500">
            Deterministic replay of rule-based checks against the current text of each item; AI findings aren’t re-run. Matching is by finding type and cited rules. It
            informs the decision; a reviewer still decides.
          </p>
        </div>
      )}
    </div>
  );
}

function Metric({ value, label, hint, tone }: { value: number; label: string; hint: string; tone: "green" | "red" | "orange" | "stone" }) {
  const c = { green: "text-emerald-700", red: "text-red-700", orange: "text-orange-700", stone: "text-stone-900" }[tone];
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-2.5" title={hint}>
      <div className={cx("text-xl font-semibold tabular-nums", c)}>{value}</div>
      <div className="text-xs font-medium text-stone-800">{label}</div>
      <div className="mt-0.5 text-[10px] leading-snug text-stone-500">{hint}</div>
    </div>
  );
}
