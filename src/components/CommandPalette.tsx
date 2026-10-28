"use client";

import { BookOpen, CornerDownLeft, FileText, Hash, LayoutGrid, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { activeBrand, brandItems, useAppState } from "@/lib/store";
import { cx, StatusBadge } from "./ui";
import { NAV_ITEMS } from "./nav";

interface Result {
  id: string;
  group: "Pages" | "Content" | "Rules" | "Facts";
  label: string;
  sub?: string;
  href: string;
  status?: Parameters<typeof StatusBadge>[0]["status"];
}

/** ⌘K / Ctrl+K search across pages, content, rules and approved facts of the current workspace. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useAppState();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 0);
  }, [open]);

  const results = useMemo<Result[]>(() => {
    if (!state) return [];
    const brand = activeBrand(state);
    const needle = q.trim().toLowerCase();
    const has = (...s: (string | undefined)[]) => !needle || s.some((x) => x?.toLowerCase().includes(needle));
    const pages: Result[] = NAV_ITEMS.filter((n) => has(n.label)).map((n) => ({ id: `p-${n.href}`, group: "Pages", label: n.label, href: n.href }));
    const content: Result[] = brandItems(state)
      .filter((i) => has(i.title, i.text))
      .slice(0, 8)
      .map((i) => ({ id: i.id, group: "Content", label: i.title, sub: i.contentType, href: `/content/${i.id}`, status: i.status }));
    const rules: Result[] = needle
      ? brand.rules.filter((r) => has(r.id, r.title, r.text)).slice(0, 5).map((r) => ({ id: r.id, group: "Rules", label: `${r.id} · ${r.title}`, sub: r.text, href: "/guidelines" }))
      : [];
    const facts: Result[] = needle
      ? brand.facts.filter((f) => has(f.id, f.statement)).slice(0, 5).map((f) => ({ id: f.id, group: "Facts", label: f.id, sub: f.statement, href: "/facts" }))
      : [];
    return [...(needle ? content : content.slice(0, 5)), ...pages, ...rules, ...facts];
  }, [state, q]);

  if (!open) return null;
  const go = (r: Result | undefined) => {
    if (!r) return;
    router.push(r.href);
    onClose();
    setQ("");
  };
  const icon = { Pages: LayoutGrid, Content: FileText, Rules: BookOpen, Facts: Hash };
  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-stone-950/20 p-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="animate-fade-up w-full max-w-xl overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lift"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-stone-200 px-3">
          <Search size={16} className="text-stone-400" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") go(results[sel]);
            }}
            placeholder="Search content, rules, facts or pages…"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[sel] ? `pr-${results[sel].id}` : undefined}
            className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
          />
          <kbd className="rounded border border-stone-200 px-1.5 text-[10px] text-stone-500">Esc</kbd>
        </div>
        <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-stone-500">No matches.</li>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup;
            lastGroup = r.group;
            const Icon = icon[r.group];
            return (
              <li key={`${r.group}-${r.id}`} role="presentation">
                {header && <div className="px-3 pb-1 pt-2 text-[11px] font-medium text-stone-400">{r.group}</div>}
                <button
                  id={`pr-${r.id}`}
                  role="option"
                  aria-selected={i === sel}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(r)}
                  className={cx("flex w-full items-center gap-2.5 px-3 py-1.5 text-left", i === sel ? "bg-stone-100" : "")}
                >
                  <Icon size={14} className="shrink-0 text-stone-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-stone-900">{r.label}</span>
                    {r.sub && <span className="block truncate text-[11px] text-stone-500">{r.sub}</span>}
                  </span>
                  {r.status && <StatusBadge status={r.status} />}
                  {i === sel && <CornerDownLeft size={12} className="text-stone-400" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
