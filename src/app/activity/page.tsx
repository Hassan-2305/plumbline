"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader, Skeleton, cx, fmtDate } from "@/components/ui";
import { useAppState } from "@/lib/store";
import { workspaceActivity, type ActivityEntry } from "@/lib/activity";

const FILTERS: { id: ActivityEntry["kind"] | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "decision", label: "Decisions" },
  { id: "comment", label: "Comments" },
  { id: "content", label: "Reviews and edits" },
  { id: "guideline", label: "Guideline changes" },
];

export default function ActivityPage() {
  const state = useAppState();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  if (!state) return <Skeleton />;
  const all = workspaceActivity(state, 300);
  const list = all.filter((a) => filter === "all" || a.kind === filter);

  // Group by calendar day.
  const groups = new Map<string, ActivityEntry[]>();
  for (const a of list) {
    const day = new Date(a.at).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    groups.set(day, [...(groups.get(day) ?? []), a]);
  }

  return (
    <div>
      <PageHeader title="Activity" description="Everything that happened in this workspace: reviews, edits, comments, decisions and guideline changes." />
      <div className="mb-5 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={cx("rounded-md px-2.5 py-1 text-[13px]", filter === f.id ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100")}
          >
            {f.label}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="border-y border-stone-200 py-8 text-center text-[13px] text-stone-500">No activity yet.</p>}
      <div className="space-y-8">
        {[...groups].map(([day, entries]) => (
          <section key={day}>
            <h2 className="mb-2 text-xs font-medium text-stone-500">{day}</h2>
            <ol className="divide-y divide-stone-200 border-y border-stone-200">
              {entries.map((a, i) => (
                <li key={i} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 py-2.5 text-[13px]">
                  <span className="text-xs tabular-nums text-stone-400">{fmtDate(a.at).split(", ").pop()}</span>
                  <span className="min-w-0">
                    <span className="font-medium text-stone-900">{a.by.replace(/\s*\(.*\)/, "")}</span>{" "}
                    <span className="text-stone-600">{a.kind === "comment" ? `commented: “${a.text}”` : a.text}</span>
                    {a.href && (
                      <Link href={a.href} className="block truncate text-xs text-stone-500 hover:text-stone-900">
                        {a.itemTitle ?? "Guidelines"}
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
