"use client";

import { BarChart3, BookOpenCheck, Compass, FileSearch, LayoutDashboard, Scale, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { activeBrand, brandConflicts, dismissStorageNotice, setRole, useAppState, useStorageNotice } from "@/lib/store";
import { BrandSwitcher } from "./brands/BrandSwitcher";
import { FeedbackButton } from "./FeedbackButton";
import { ROLES, roleMeta } from "@/lib/roles";
import { TourProvider, useTour } from "./tour/Tour";
import { cx } from "./ui";

const GROUPS = [
  {
    label: "Workspace",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/review", label: "Review Content", icon: FileSearch },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/guidelines", label: "Guidelines", icon: BookOpenCheck },
      { href: "/insights", label: "Insights", icon: BarChart3 },
    ],
  },
];
const ALL = [...GROUPS.flatMap((g) => g.items), { href: "/settings", label: "Settings", icon: Settings }];

function RoleSwitch({ compact }: { compact?: boolean }) {
  const state = useAppState();
  if (!state) return null;
  return (
    <div data-tour="role-switch" role="radiogroup" aria-label="Acting as (simulated role)" className={cx("grid grid-cols-3 rounded-lg bg-stone-200/60 p-0.5 text-[11px]", compact && "w-[11.5rem]")}>
      {ROLES.map((r) => (
        <button
          key={r.id}
          role="radio"
          aria-checked={state.role === r.id}
          title={r.blurb}
          onClick={() => setRole(r.id)}
          className={cx("rounded-md py-1.5 transition-colors", state.role === r.id ? "bg-white font-medium text-stone-900 shadow-soft" : "text-stone-500 hover:text-stone-800")}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function NavLink({ href, label, icon: Icon, current, badge }: (typeof ALL)[number] & { current: boolean; badge: number }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cx(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
        current ? "bg-white text-stone-950 font-medium shadow-soft ring-1 ring-stone-200/80" : "text-stone-600 hover:text-stone-950 hover:bg-stone-200/50",
      )}
    >
      <Icon size={16} className={current ? "text-orange-600" : "text-stone-400 group-hover:text-stone-600"} />
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="rounded-full bg-orange-600 px-1.5 text-[10px] font-semibold leading-4 text-white" aria-label={`${badge} items need a decision`}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const state = useAppState();
  const notice = useStorageNotice();
  const tour = useTour();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const openConflicts = state ? brandConflicts(state).filter((c) => c.status === "open").length : 0;
  const pendingChanges = state ? activeBrand(state).changes.filter((c) => c.status === "pending").length : 0;
  const govBadge = (href: string) => (href === "/guidelines" ? openConflicts + pendingChanges : 0);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow-lift">
        Skip to content
      </a>
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-stone-200 bg-stone-100/60 sticky top-0 h-screen">
        <Link href="/" className="flex items-center gap-2.5 px-5 h-16">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-orange-500">
            <Scale size={17} />
          </span>
          <span className="font-serif text-[1.35rem] tracking-tight text-stone-950">Plumbline Jury</span>
        </Link>
        {state && (
          <div className="mx-3 mb-2">
            <BrandSwitcher />
          </div>
        )}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5" aria-label="Main">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">{g.label}</div>
              <div className="space-y-0.5">
                {g.items.map((i) => (
                  <NavLink key={i.href} {...i} current={active(i.href)} badge={govBadge(i.href)} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="space-y-3 px-3 pb-4">
          <button
            onClick={tour.start}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-stone-600 hover:bg-stone-200/50 hover:text-stone-950"
          >
            <Compass size={16} className="text-stone-400" /> Take the tour
          </button>
          <FeedbackButton />
          <NavLink href="/settings" label="Settings" icon={Settings} current={active("/settings")} badge={0} />
          {state && (
            <div className="rounded-lg border border-stone-200/80 bg-white p-2.5 shadow-soft">
              <div className="mb-1.5 flex items-center justify-between px-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
                Acting as <span className="font-normal normal-case tracking-normal">simulated</span>
              </div>
              <RoleSwitch />
              <p className="mt-1.5 px-0.5 text-[11px] leading-snug text-stone-500">{roleMeta(state.role).person}</p>
            </div>
          )}
        </div>
      </aside>

      <header className="md:hidden sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-2 px-4 h-14">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-stone-900 text-orange-500">
            <Scale size={15} />
          </span>
          <span className="font-serif text-xl text-stone-950">Plumbline Jury</span>
          <span className="ml-auto flex items-center">
            <FeedbackButton compact />
            <button onClick={tour.start} aria-label="Take the tour" className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100">
              <Compass size={18} />
            </button>
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 pb-2">
          <div className="min-w-0 flex-1"><BrandSwitcher /></div>
          <div className="shrink-0"><RoleSwitch compact /></div>
        </div>
        <nav className="flex overflow-x-auto px-3 pb-2 gap-1" aria-label="Main mobile">
          {ALL.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={cx("shrink-0 rounded-full px-3 py-1.5 text-xs", active(href) ? "bg-stone-900 text-white" : "text-stone-600 bg-stone-100")}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main id="main" className="flex-1 min-w-0">
        {notice && (
          <div role="status" className="flex items-start gap-3 bg-orange-50 border-b border-orange-200 px-6 py-2.5 text-sm text-orange-900">
            <span className="flex-1">{notice}</span>
            <button onClick={dismissStorageNotice} className="text-xs underline">Dismiss</button>
          </div>
        )}
        <div className="mx-auto max-w-[1360px] px-4 py-6 md:px-10 md:py-10">{children}</div>
      </main>
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
