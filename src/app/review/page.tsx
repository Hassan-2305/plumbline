"use client";

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, ButtonLink, Card, PageHeader, Skeleton, StatusBadge, STATUS_LABEL, cx, fmtDate } from "@/components/ui";
import { deleteItem, unresolvedHighRisk, useAppState, brandItems } from "@/lib/store";
import type { ContentStatus } from "@/lib/types";

export default function ReviewList() {
  const state = useAppState();
  const [filter, setFilter] = useState<ContentStatus | "all">("all");
  if (!state) return <Skeleton />;
  const all = brandItems(state);
  const items = [...all]
    .filter((i) => filter === "all" || i.status === filter)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div>
      <PageHeader
        title="Review Content"
        description="Every draft, its review findings and its approval status. Open one to inspect evidence, accept fixes or approve."
        actions={
          <ButtonLink href="/review/new" variant="accent">
            <Plus size={15} /> New review
          </ButtonLink>
        }
      />
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(["all", "draft", "under_review", "changes_requested", "approved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cx("rounded-md px-2.5 py-1 text-xs border", filter === f ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-700 border-stone-300 hover:bg-stone-50")}
          >
            {f === "all" ? "All" : STATUS_LABEL[f]} ({f === "all" ? all.length : all.filter((i) => i.status === f).length})
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1fr_130px_110px_80px_150px_40px] gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200">
          <span>Content</span>
          <span>Type</span>
          <span>Open findings</span>
          <span>Versions</span>
          <span>Status</span>
          <span />
        </div>
        {items.length === 0 && <div className="px-4 py-10 text-center text-sm text-stone-500">No content with this status.</div>}
        {items.map((it) => {
          const open = it.findings.filter((f) => f.status === "open" || f.status === "escalated").length;
          const hr = unresolvedHighRisk(it).length;
          return (
            <div key={it.id} className="grid lg:grid-cols-[1fr_130px_110px_80px_150px_40px] gap-1 lg:gap-3 items-center px-4 py-3 border-b border-stone-100 last:border-0 hover:bg-stone-50">
              <Link href={`/review/${it.id}`} className="min-w-0">
                <div className="truncate text-sm font-medium text-stone-900">{it.title}</div>
                <div className="text-xs text-stone-500 truncate">
                  Updated {fmtDate(it.updatedAt)} {it.seeded && <Badge tone="orange" className="ml-1">Seeded demo history</Badge>}
                </div>
              </Link>
              <span className="text-xs text-stone-600">{it.contentType}</span>
              <span className="text-xs text-stone-700 flex items-center gap-1.5">
                {open}
                {hr > 0 && (
                  <span className="flex items-center gap-0.5 text-red-700">
                    <AlertTriangle size={12} /> {hr} high
                  </span>
                )}
              </span>
              <span className="text-xs text-stone-600">v{it.versions[it.versions.length - 1]?.number ?? 1}</span>
              <span><StatusBadge status={it.status} /></span>
              <button
                aria-label={`Delete ${it.title}`}
                onClick={() => confirm(`Delete "${it.title}"? This removes it from local storage.`) && deleteItem(it.id)}
                className="text-stone-400 hover:text-red-600 justify-self-start lg:justify-self-end"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
