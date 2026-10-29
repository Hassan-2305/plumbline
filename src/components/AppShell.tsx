"use client";

import { Check, ChevronsUpDown, Compass, Menu, Search, X } from "lucide-react";
import { LogoMark } from "./Logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { activeBrand, brandConflicts, brandItems, dismissStorageNotice, setRole, useAppState, useStorageNotice } from "@/lib/store";
import { BrandSwitcher } from "./brands/BrandSwitcher";
import { FeedbackButton } from "./FeedbackButton";
import { CommandPalette } from "./CommandPalette";
import { NotificationBell } from "./Notifications";
import { NAV_GROUPS, type NavItem } from "./nav";
import { ROLES, roleMeta } from "@/lib/roles";
import { TourProvider, useTour } from "./tour/Tour";
import { cx } from "./ui";

export function personName(person: string) {
  return person.replace(/\s*\(.*\)/, "");
}

function initials(name: string) {
  return personName(name)
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Simulated user switcher, shown in the sidebar footer and as the top-bar avatar. */
function ProfileMenu({ variant }: { variant: "sidebar" | "avatar" }) {
  const state = useAppState();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  if (!state) return null;
  const me = roleMeta(state.role);
  return (
    <div ref={ref} className="relative">
      {variant === "sidebar" ? (
        <button
          data-tour="role-switch"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Signed in as ${me.person}. Switch user`}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-stone-100"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900 text-[13px] font-semibold text-white">{initials(me.person)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium text-stone-900">{personName(me.person)}</span>
            <span className="block truncate text-xs text-stone-500">{me.label} · simulated</span>
          </span>
          <ChevronsUpDown size={14} className="text-stone-400" />
        </button>
      ) : (
        <button
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Signed in as ${me.person}. Switch user`}
          onClick={() => setOpen(!open)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-900 text-[13px] font-semibold text-white ring-offset-2 transition hover:ring-2 hover:ring-stone-300"
        >
          {initials(me.person)}
        </button>
      )}
      {open && (
        <div
          role="menu"
          className={cx(
            "animate-fade-up absolute z-50 w-72 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lift",
            variant === "sidebar" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2",
          )}
        >
          <div className="px-2 pb-1.5 pt-1 text-xs text-stone-500">Switch user (simulated, no login)</div>
          {ROLES.map((r) => (
            <button
              key={r.id}
              role="menuitemradio"
              aria-checked={state.role === r.id}
              onClick={() => {
                setRole(r.id);
                setOpen(false);
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-stone-50"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[11px] font-semibold text-stone-700">{initials(r.person)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-stone-900">{r.person}</span>
                <span className="block text-xs leading-snug text-stone-500">{r.blurb}</span>
              </span>
              {state.role === r.id && <Check size={14} className="mt-1 text-accent-600" />}
            </button>
          ))}
          <Link href="/team" onClick={() => setOpen(false)} className="mt-1 block rounded-lg border-t border-stone-100 px-2 py-2 text-xs text-stone-600 hover:bg-stone-50">
            View team and permissions →
          </Link>
        </div>
      )}
    </div>
  );
}

function NavLink({ item, current, count, onNavigate }: { item: NavItem; current: boolean; count?: number; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={cx(
        "group flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] transition-colors duration-150",
        current ? "bg-accent-50 font-medium text-accent-700" : "text-stone-700 hover:bg-stone-100 hover:text-stone-950",
      )}
    >
      <Icon size={18} strokeWidth={1.75} className={current ? "text-accent-600" : "text-stone-500 group-hover:text-stone-700"} />
      <span className="flex-1 truncate">{item.label}</span>
      {!!count && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1.5 text-[11px] font-semibold tabular-nums text-white" aria-label={`${count} need attention`}>
          {count}
        </span>
      )}
    </Link>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const state = useAppState();
  const tour = useTour();
  const active = (href: string) =>
    href === "/" ? path === "/" : href === "/content" ? path === "/content" || (path.startsWith("/content/") && !path.startsWith("/content/new")) : path.startsWith(href);
  const items = state ? brandItems(state) : [];
  const counts: Record<string, number> = state
    ? {
        "/reviews": items.filter((i) => i.status === "in_review" || i.status === "changes_requested").length,
        "/approvals": items.filter((i) => i.status === "ready_for_approval").length,
        "/guidelines": brandConflicts(state).filter((c) => c.status === "open").length + activeBrand(state).changes.filter((c) => c.status === "pending").length,
      }
    : {};

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <LogoMark size={34} className="shrink-0" />
        <span className="font-serif text-[24px] leading-none tracking-tight text-stone-950">Plumbline Jury</span>
      </Link>
      <div className="px-4">{state && <BrandSwitcher />}</div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Main">
        {NAV_GROUPS.map((g, gi) => (
          <div key={gi}>
            {g.label && <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">{g.label}</div>}
            <div className="space-y-0.5">
              {g.items.map((i) => (
                <NavLink key={i.href} item={i} current={active(i.href)} count={counts[i.href]} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-0.5 px-3 pb-2">
        <button
          onClick={() => {
            onNavigate?.();
            tour.start();
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[14px] text-stone-700 hover:bg-stone-100"
        >
          <Compass size={18} strokeWidth={1.75} className="text-stone-500" /> Product tour
        </button>
        <FeedbackButton />
      </div>
      <div className="border-t border-stone-200/80 px-3 py-3">
        <ProfileMenu variant="sidebar" />
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const notice = useStorageNotice();
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow-lift">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-stone-200/80 bg-white lg:block">
        <SidebarBody />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-stone-950/30" onClick={() => setDrawer(false)} />
          <div className="animate-fade-up absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-lift">
            <button aria-label="Close navigation" onClick={() => setDrawer(false)} className="absolute right-3 top-5 z-10 rounded-lg p-1.5 text-stone-500 hover:bg-stone-100">
              <X size={18} />
            </button>
            <SidebarBody onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-stone-200/60 bg-background/90 px-4 backdrop-blur md:px-8">
          <button aria-label="Open navigation" onClick={() => setDrawer(true)} className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 lg:hidden">
            <Menu size={20} />
          </button>
          <button
            onClick={() => setSearch(true)}
            className="flex h-10 min-w-0 max-w-md flex-1 items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-3.5 text-left text-[14px] text-stone-500 shadow-soft transition-colors hover:border-stone-300"
          >
            <Search size={17} className="shrink-0" />
            <span className="flex-1 truncate">Search content, guidelines, or people…</span>
            <kbd className="hidden rounded-md border border-stone-200 px-1.5 text-[11px] text-stone-400 sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <ProfileMenu variant="avatar" />
          </div>
        </header>
        <main id="main" className="min-w-0 flex-1">
          {notice && (
            <div role="status" className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-8 py-2 text-[13px] text-amber-900">
              <span className="flex-1">{notice}</span>
              <button onClick={dismissStorageNotice} className="text-xs underline">Dismiss</button>
            </div>
          )}
          <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</div>
        </main>
      </div>
      <CommandPalette open={search} onClose={() => setSearch(false)} />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TourProvider>
      <Shell>{children}</Shell>
    </TourProvider>
  );
}
