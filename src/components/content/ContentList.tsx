"use client";

import { AlertTriangle, FileText, Lock, Mail, Megaphone, MessageSquare, Newspaper, PanelTop, Share2 } from "lucide-react";
import Link from "next/link";
import { StatusBadge, cx, timeAgo } from "@/components/ui";
import { openFindingCounts } from "@/lib/activity";
import { roleMeta } from "@/lib/roles";
import type { ContentItem, ContentType, Role } from "@/lib/types";

const TYPE_ICON: Record<ContentType, typeof FileText> = {
  "Social post": Share2,
  "Marketing email": Mail,
  "Web copy": PanelTop,
  "Ad copy": Megaphone,
  "Press release": Newspaper,
  Document: FileText,
};

export function Avatar({ role, size = 20 }: { role?: Role; size?: number }) {
  if (!role) return null;
  const p = roleMeta(role).person;
  const ini = p.replace(/\s*\(.*\)/, "").slice(0, 1).toUpperCase();
  return (
    <span
      title={p}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-stone-200 font-semibold text-stone-700"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {ini}
    </span>
  );
}

/** Dense, scannable content rows: title, type, lifecycle, people, outstanding findings, age. */
export function ContentList({ items, empty, showHeader = true }: { items: ContentItem[]; empty?: React.ReactNode; showHeader?: boolean }) {
  if (!items.length) return <div className="border-y border-stone-200 py-8 text-center text-[13px] text-stone-500">{empty ?? "Nothing here."}</div>;
  return (
    <div className="@container border-t border-stone-200">
      {showHeader && (
        <div className="hidden grid-cols-[minmax(0,1fr)_150px_120px_90px_80px] gap-4 border-b border-stone-200 py-1.5 text-[11px] font-medium text-stone-500 @2xl:grid">
          <span>Content</span>
          <span>Status</span>
          <span>Creator → reviewer</span>
          <span>Findings</span>
          <span className="text-right">Updated</span>
        </div>
      )}
      <ul>
        {items.map((i) => {
          const Icon = TYPE_ICON[i.contentType] ?? FileText;
          const f = openFindingCounts(i);
          const unresolvedComments = (i.comments ?? []).filter((c) => !c.resolved).length;
          return (
            <li key={i.id} className="border-b border-stone-200">
              <Link
                href={`/content/${i.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-2.5 transition-colors hover:bg-stone-50 @2xl:grid-cols-[minmax(0,1fr)_150px_120px_90px_80px]"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon size={15} className="shrink-0 text-stone-400" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-stone-900">{i.title}</span>
                      {i.confidential && <Lock size={11} className="shrink-0 text-stone-500" aria-label="Confidential" />}
                      {unresolvedComments > 0 && (
                        <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-stone-500">
                          <MessageSquare size={11} /> {unresolvedComments}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-stone-500">
                      {i.contentType}
                      {i.seeded && " · seeded demo"}
                    </span>
                  </span>
                </span>
                <span className="justify-self-end @2xl:justify-self-start">
                  <StatusBadge status={i.status} />
                </span>
                <span className="hidden items-center gap-1 text-stone-400 @2xl:flex">
                  <Avatar role={i.createdBy} /> → <Avatar role={i.assignee} />
                </span>
                <span className={cx("hidden items-center gap-1 text-[12px] tabular-nums @2xl:flex", f.high ? "text-red-700" : "text-stone-600")}>
                  {f.high > 0 && <AlertTriangle size={12} />}
                  {f.open ? `${f.open} open` : <span className="text-stone-400">None</span>}
                </span>
                <span className="hidden text-right text-[12px] text-stone-500 @2xl:block">{timeAgo(i.updatedAt)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
