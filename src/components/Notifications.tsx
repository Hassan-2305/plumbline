"use client";

import { AtSign, Bell, CircleCheck, GitCompareArrows, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { activeBrand, brandConflicts, brandItems, mentionsFor, useAppState } from "@/lib/store";
import { can } from "@/lib/roles";
import { timeAgo } from "./ui";

/** What needs the current user, derived from real workspace state (no fake alerts). */
export function useNotifications() {
  const state = useAppState();
  if (!state) return [];
  const items = brandItems(state);
  const out: { key: string; icon: React.ReactNode; title: string; sub: string; href: string; at: string }[] = [];
  for (const { item, comment } of mentionsFor(state, state.role)) {
    out.push({ key: comment.id, icon: <AtSign size={14} />, title: `${comment.by.replace(/\s*\(.*\)/, "")} mentioned you`, sub: `${item.title}: “${comment.text}”`, href: `/content/${item.id}`, at: comment.at });
  }
  if (can(state.role, "content.approve"))
    for (const i of items.filter((x) => x.status === "ready_for_approval" && x.assignee === state.role))
      out.push({ key: `a-${i.id}`, icon: <CircleCheck size={14} />, title: "Waiting for your approval", sub: i.title, href: `/content/${i.id}`, at: i.updatedAt });
  if (can(state.role, "content.submit"))
    for (const i of items.filter((x) => x.status === "changes_requested" && !x.seeded))
      out.push({ key: `c-${i.id}`, icon: <Undo2 size={14} />, title: "Changes requested", sub: i.title, href: `/content/${i.id}`, at: i.updatedAt });
  if (can(state.role, "guideline.approve")) {
    const n = brandConflicts(state).filter((c) => c.status === "open").length + activeBrand(state).changes.filter((c) => c.status === "pending").length;
    if (n) out.push({ key: "g", icon: <GitCompareArrows size={14} />, title: `${n} guideline decision${n > 1 ? "s" : ""}`, sub: "Conflicts or proposals waiting for a reviewer", href: "/guidelines", at: "" });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function NotificationBell() {
  const list = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        aria-label={`Notifications${list.length ? `, ${list.length} new` : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="relative rounded-full p-2 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
      >
        <Bell size={19} />
        {list.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-600 ring-2 ring-white" />}
      </button>
      {open && (
        <div role="menu" className="animate-fade-up absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lift">
          <div className="px-2 pb-1.5 pt-1 text-[13px] font-medium text-stone-900">Notifications</div>
          {list.length === 0 && <p className="px-2 py-4 text-center text-[13px] text-stone-500">You’re all caught up.</p>}
          {list.slice(0, 8).map((n) => (
            <Link key={n.key} role="menuitem" href={n.href} onClick={() => setOpen(false)} className="flex gap-2.5 rounded-lg px-2 py-2 hover:bg-stone-50">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700">{n.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-stone-900">{n.title}</span>
                <span className="block truncate text-xs text-stone-500">{n.sub}</span>
              </span>
              {n.at && <span className="shrink-0 text-[11px] text-stone-400">{timeAgo(n.at)}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
