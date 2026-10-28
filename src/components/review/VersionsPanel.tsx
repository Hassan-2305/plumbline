"use client";

import { useState } from "react";
import { Badge, Card, SectionTitle, cx, fmtDate } from "@/components/ui";
import { diffWords } from "@/lib/engine/diff";
import type { ContentItem } from "@/lib/types";

export function Diff({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before, after);
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">
      {parts.map((p, i) => (
        <span
          key={i}
          className={cx(p.type === "add" && "bg-emerald-100 text-emerald-900", p.type === "del" && "bg-red-100 text-red-800 line-through decoration-red-400 mr-0.5")}
        >
          {p.text}
        </span>
      ))}
    </div>
  );
}

export function VersionsPanel({ item }: { item: ContentItem }) {
  const versions = item.versions;
  const [sel, setSel] = useState(versions.length - 1);
  const [base, setBase] = useState<"previous" | "original">("original");
  const cur = versions[Math.min(sel, versions.length - 1)];
  const compare = base === "original" ? versions[0] : versions[Math.max(0, sel - 1)];
  const accepted = item.findings.filter((f) => f.status === "accepted" || f.status === "edited");
  const dismissed = item.findings.filter((f) => f.status === "dismissed");
  const approvedVersions = new Set(item.approvals.filter((a) => a.decision === "approved").map((a) => a.versionNumber));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <div>
          <SectionTitle>Versions</SectionTitle>
          <ol className="space-y-1">
            {versions.map((v, i) => (
              <li key={v.id}>
                <button
                  onClick={() => setSel(i)}
                  className={cx("w-full text-left rounded-md border px-2.5 py-1.5", i === sel ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:bg-stone-50")}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-900">
                    v{v.number}
                    {approvedVersions.has(v.number) && <Badge tone="green">Approved</Badge>}
                  </div>
                  <div className="text-[11px] text-stone-500 truncate">{v.label}</div>
                  <div className="text-[11px] text-stone-400">{fmtDate(v.createdAt)}</div>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
            <span className="font-medium text-stone-900">
              v{cur.number} compared with {base === "original" ? "original (v1)" : `v${compare.number}`}
            </span>
            <span className="ml-auto flex rounded border border-stone-300 p-0.5">
              {(["original", "previous"] as const).map((b) => (
                <button key={b} onClick={() => setBase(b)} className={cx("rounded px-2 py-0.5 capitalize", base === b ? "bg-stone-900 text-white" : "text-stone-600")}>
                  vs {b}
                </button>
              ))}
            </span>
          </div>
          {cur.number === compare.number ? (
            <p className="whitespace-pre-wrap text-sm text-stone-800">{cur.text}</p>
          ) : (
            <Diff before={compare.text} after={cur.text} />
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <SectionTitle>Accepted fixes ({accepted.length})</SectionTitle>
          {accepted.length === 0 && <p className="text-xs text-stone-500">None yet.</p>}
          <ul className="space-y-1.5">
            {accepted.map((f) => {
              const d = [...f.history].reverse().find((h) => h.action === "accepted" || h.action === "edited");
              return (
                <li key={f.id} className="rounded border border-stone-200 px-3 py-2 text-xs">
                  <div className="font-medium text-stone-900">{f.id} · {f.title}</div>
                  {d?.before !== undefined && (
                    <div className="mt-1">
                      <span className="bg-red-100 line-through">{d.before}</span> → <span className="bg-emerald-100">{d.after}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <SectionTitle>Dismissed findings ({dismissed.length})</SectionTitle>
          {dismissed.length === 0 && <p className="text-xs text-stone-500">None yet.</p>}
          <ul className="space-y-1.5">
            {dismissed.map((f) => {
              const d = [...f.history].reverse().find((h) => h.action === "dismissed");
              return (
                <li key={f.id} className="rounded border border-stone-200 px-3 py-2 text-xs">
                  <div className="font-medium text-stone-900">{f.id} · {f.title}</div>
                  <div className="text-stone-600">
                    <strong>{d?.reason}</strong>
                    {d?.note && ` — ${d.note}`} <span className="text-stone-400">· {d && fmtDate(d.at)} · {d?.by}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
