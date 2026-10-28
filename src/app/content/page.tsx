"use client";

import { FilePlus2, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ButtonLink, PageHeader, Skeleton, STATUS_DOT, STATUS_LABEL, cx } from "@/components/ui";
import { ContentList } from "@/components/content/ContentList";
import { brandItems, useAppState } from "@/lib/store";
import { CONTENT_TYPES, LIFECYCLE, type ContentStatus } from "@/lib/types";

function Library() {
  const state = useAppState();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  if (!state) return <Skeleton />;

  const status = (params.get("status") ?? "") as ContentStatus | "";
  const all = brandItems(state);
  const needle = q.trim().toLowerCase();
  const items = all
    .filter((i) => !status || i.status === status)
    .filter((i) => !type || i.contentType === type)
    .filter((i) => !mineOnly || i.createdBy === state.role)
    .filter((i) => !needle || i.title.toLowerCase().includes(needle) || i.text.toLowerCase().includes(needle))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const setStatus = (s: string) => router.replace(s ? `/content?status=${s}` : "/content");

  return (
    <div>
      <PageHeader
        title="Content"
        description="Every draft in this workspace, from first draft to approval."
        actions={
          <ButtonLink href="/content/new" variant="primary">
            <FilePlus2 size={14} /> New content
          </ButtonLink>
        }
      />
      <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Filter by status">
        {(["", ...LIFECYCLE] as const).map((s) => {
          const n = s ? all.filter((i) => i.status === s).length : all.length;
          return (
            <button
              key={s || "all"}
              role="tab"
              aria-selected={status === s}
              onClick={() => setStatus(s)}
              className={cx(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] transition-colors",
                status === s ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100",
              )}
            >
              {s && <span className={cx("h-1.5 w-1.5 rounded-full", STATUS_DOT[s])} />}
              {s ? STATUS_LABEL[s] : "All"}
              <span className={cx("tabular-nums", status === s ? "text-stone-300" : "text-stone-400")}>{n}</span>
            </button>
          );
        })}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Search content</span>
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles and text"
            className="h-8 w-full rounded-md border border-stone-300 bg-white pl-8 pr-2.5 text-[13px] focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
          />
        </label>
        <select aria-label="Content type" value={type} onChange={(e) => setType(e.target.value)} className="h-8 rounded-md border border-stone-300 bg-white px-2 text-[13px] text-stone-700">
          <option value="">All types</option>
          {CONTENT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[13px] text-stone-700">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> Created by me
        </label>
      </div>
      <ContentList items={items} empty={needle || status || type || mineOnly ? "No content matches these filters." : "No content yet. Create your first draft."} />
    </div>
  );
}

export default function ContentPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Library />
    </Suspense>
  );
}
