"use client";

import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, PageHeader, SectionTitle, Skeleton, Stat } from "@/components/ui";
import { useAppState, brandConflicts } from "@/lib/store";
import { computeInsights } from "@/lib/insights";

export default function InsightsPage() {
  const state = useAppState();
  const [includeSeeded, setIncludeSeeded] = useState(true);
  if (!state) return <Skeleton />;
  const ins = computeInsights(state, includeSeeded);
  const flaggedData = ins.topFlagged.map((r) => ({ rule: r.ruleId, Accepted: r.accepted, Dismissed: r.dismissed, Other: r.flagged - r.accepted - r.dismissed }));
  const reasonData = ins.reasons.map((r) => ({ reason: r.reason, count: r.count }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Insights"
        description="Where reviewers agree with the jury, where they push back, and which guidelines cause confusion. Calculated from stored review history."
        actions={
          <label className="flex items-center gap-2 rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700">
            <input type="checkbox" checked={includeSeeded} onChange={(e) => setIncludeSeeded(e.target.checked)} />
            Include seeded demo history ({ins.seededItems})
          </label>
        }
      />
      <p className="-mt-4 text-xs text-stone-500">
        {includeSeeded
          ? `Includes ${ins.seededItems} seeded demo items (fictional decisions, labelled) and ${ins.userItems} ${ins.userItems === 1 ? "item" : "items"} created in this browser.`
          : `Only the ${ins.userItems} ${ins.userItems === 1 ? "item" : "items"} created in this browser.`}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Review runs" value={ins.totalReviews} />
        <Stat label="Findings raised" value={ins.totalFindings} />
        <Stat label="Open findings" value={ins.openFindings} />
        <Stat label="High-risk open" value={ins.highRiskOpen} accent={ins.highRiskOpen > 0} />
        <Stat label="Fixes accepted / dismissed" value={`${ins.accepted} / ${ins.dismissed}`} />
      </div>

      {ins.totalFindings === 0 ? (
        <Card className="p-8 text-sm text-stone-600">
          No findings yet{includeSeeded ? "" : " in your own history"}. <Link href="/content/new" className="text-accent-700 underline">Run a review</Link> to start building insights.
        </Card>
      ) : (
        <>
          <section data-tour="confusing">
            <SectionTitle><span className="flex items-center gap-1.5"><AlertTriangle size={14} className="text-amber-600" /> Potentially confusing guidelines</span></SectionTitle>
            <p className="-mt-1 mb-3 text-xs text-stone-500">
              Signal: a rule is dismissed as “Rule unclear” at least twice, or dismissed in at least half of 3+ findings. Dismissals are reviewer signals, not proof the jury was wrong.
            </p>
            {ins.confusing.length === 0 && <Card className="p-4 text-sm text-stone-600">No rule meets the confusion threshold.</Card>}
            <div className="grid gap-3 lg:grid-cols-2">
              {ins.confusing.map((r) => {
                const conflict = brandConflicts(state).find((c) => c.ruleIds.includes(r.ruleId));
                return (
                  <Card key={r.ruleId} className="p-4 border-amber-300">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{r.ruleId}</span>
                      <span className="text-sm text-stone-800">{r.title}</span>
                      <Badge tone="amber" className="ml-auto">{Math.round(r.dismissRate * 100)}% dismissed</Badge>
                    </div>
                    <p className="mt-1 text-xs text-stone-600">
                      Flagged {r.flagged}× · dismissed {r.dismissed}× · “Rule unclear” {r.unclear}× · accepted {r.accepted}×
                    </p>
                    <ul className="mt-2 space-y-1">
                      {r.examples.slice(0, 3).map((e, i) => (
                        <li key={i} className="text-xs text-stone-700 border-l-2 border-stone-200 pl-2">
                          <span className="font-medium">{e.item}</span>{e.seeded && <span className="text-amber-700"> (seeded)</span>} — {e.reason}
                          {e.note && <>: “{e.note}”</>}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 rounded bg-stone-50 border border-stone-200 p-2.5 text-xs text-stone-700">
                      <strong>Suggested improvement: </strong>
                      {conflict
                        ? conflict.status === "open"
                          ? `Resolve the ${conflict.ruleIds.join(" ↔ ")} conflict — a clarification is drafted for approval.`
                          : `Conflict ${conflict.ruleIds.join(" ↔ ")} was ${conflict.status}. Watch whether dismissals drop.`
                        : `Add worked examples to ${r.ruleId} that show what is and isn’t allowed, based on the dismissal notes above.`}
                      {conflict?.status === "open" && (
                        <Link href="/guidelines" className="ml-1 inline-flex items-center gap-0.5 text-amber-700 font-medium">
                          Review clarification <ArrowRight size={12} />
                        </Link>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-stone-500">Guideline revisions always require human approval.</p>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="p-4">
              <SectionTitle>Most frequently flagged rules</SectionTitle>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={flaggedData} margin={{ left: -20, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                    <XAxis dataKey="rule" tick={{ fontSize: 11, fill: "#737373" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#737373" }} />
                    <Tooltip cursor={{ fill: "#f5f5f5" }} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Bar dataKey="Accepted" stackId="a" fill="#44403c" />
                    <Bar dataKey="Dismissed" stackId="a" fill="#ea580c" />
                    <Bar dataKey="Other" name="Open / escalated" stackId="a" fill="#d6d3d1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex gap-3 text-[11px] text-stone-600">
                <span className="flex items-center gap-1"><span className="h-2 w-2 bg-stone-800" /> Accepted</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 bg-accent-500" /> Dismissed</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 bg-stone-300" /> Open / escalated</span>
              </div>
            </Card>
            <Card className="p-4">
              <SectionTitle>Dismissal reasons</SectionTitle>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reasonData} layout="vertical" margin={{ left: 40, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#737373" }} />
                    <YAxis type="category" dataKey="reason" tick={{ fontSize: 11, fill: "#737373" }} width={110} />
                    <Tooltip cursor={{ fill: "#f5f5f5" }} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Bar dataKey="count" name="Dismissals" fill="#ea580c" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>

          <section>
            <SectionTitle>Most frequently dismissed rules</SectionTitle>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-stone-50 text-left text-[11px]r text-stone-500">
                  <tr>
                    <th className="px-4 py-2">Rule</th>
                    <th className="px-4 py-2">Flagged</th>
                    <th className="px-4 py-2">Dismissed</th>
                    <th className="px-4 py-2">“Rule unclear”</th>
                    <th className="px-4 py-2">Dismissal rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {ins.topDismissed.map((r) => (
                    <tr key={r.ruleId}>
                      <td className="px-4 py-2"><span className="font-mono font-semibold">{r.ruleId}</span> <span className="text-stone-600">{r.title}</span></td>
                      <td className="px-4 py-2 tabular-nums">{r.flagged}</td>
                      <td className="px-4 py-2 tabular-nums">{r.dismissed}</td>
                      <td className="px-4 py-2 tabular-nums">{r.unclear}</td>
                      <td className="px-4 py-2 tabular-nums">{Math.round(r.dismissRate * 100)}%</td>
                    </tr>
                  ))}
                  {ins.topDismissed.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-4 text-stone-500">No dismissals yet.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
