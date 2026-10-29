"use client";

import { AlertCircle, ArrowRight, BookOpen, Check, ChevronRight, FileText, LayoutTemplate, Palette, PenLine, Quote, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Skeleton, StatusBadge, cx, timeAgo } from "@/components/ui";
import { ContentThumb, TypeIcon } from "@/components/content/ContentThumb";
import { TemplatesModal } from "@/components/content/TemplatesModal";
import { personName } from "@/components/AppShell";
import { activeBrand, brandItems, createFromExample, useAppState } from "@/lib/store";
import { openFindingCounts, topIssues, workspaceActivity } from "@/lib/activity";
import { analyzeUrl } from "@/lib/image/analyze";
import { roleMeta } from "@/lib/roles";
import { factState } from "@/lib/engine/evidence";
import type { ContentItem, ContentStatus } from "@/lib/types";

const RAIL_CARD = "rounded-2xl border border-stone-200/80 bg-white p-5 shadow-soft";

function Initial({ name, dark }: { name: string; dark?: boolean }) {
  return (
    <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", dark ? "bg-stone-900 text-white" : "bg-stone-200 text-stone-700")}>
      {personName(name).slice(0, 1)}
    </span>
  );
}

function findingLabel(i: ContentItem) {
  const f = openFindingCounts(i);
  if (f.high) return `${f.high} high-risk finding${f.high > 1 ? "s" : ""}`;
  if (f.open) return `${f.open} finding${f.open > 1 ? "s" : ""}`;
  return i.status === "approved" ? "Approved" : "No open findings";
}

/** Illustrative preview of the reviewed sample post; clicking opens the real thing. */
function HeroPreview({ onOpen, busy }: { onOpen: () => void; busy: boolean }) {
  const issues = [
    { title: "Unsupported clinical claim", sub: "No approved evidence (R-005)", tone: "text-red-600 bg-red-50" },
    { title: "Banned phrase", sub: "“miracle formula” (R-004)", tone: "text-red-600 bg-red-50" },
    { title: "Number contradicts a fact", sub: "40g vs approved 24g (F-001)", tone: "text-red-600 bg-red-50" },
  ];
  return (
    <button data-tour="try-demo" onClick={onOpen} disabled={busy} className="group relative block w-full max-w-[400px] text-left" aria-label="Open the reviewed sample post">
      <div className="rounded-2xl border border-stone-200/80 bg-white p-3 shadow-lift transition-transform duration-200 group-hover:-translate-y-0.5">
        <div className="flex items-center gap-2 px-1 pb-2 text-xs text-stone-600">
          <TypeIcon type="Social post" size={22} /> Social post
          <span className="ml-auto text-[11px] text-accent-700 opacity-0 transition-opacity group-hover:opacity-100">{busy ? "Opening…" : "Open sample →"}</span>
        </div>
        <div className="grid grid-cols-[150px_1fr] gap-2">
          <div className="relative overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- bundled fictional illustration */}
            <img src="/demo/northstar-jar.svg" alt="" className="h-full w-full object-cover" />
            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-stone-900/85 px-2 py-0.5 text-[11px] font-medium text-white">
              <AlertCircle size={11} className="text-red-400" /> 3 high-risk
            </span>
          </div>
          <ul className="space-y-1.5">
            {issues.map((i) => (
              <li key={i.title} className="flex gap-2 rounded-xl border border-stone-200/80 bg-white p-2">
                <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", i.tone)}>
                  <AlertCircle size={13} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-medium text-stone-900">{i.title}</span>
                  <span className="block truncate text-[11px] text-stone-500">{i.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </button>
  );
}

const STATUS_BAR: { status: ContentStatus; label: string; color: string }[] = [
  { status: "approved", label: "Approved", color: "bg-emerald-600" },
  { status: "ready_for_approval", label: "Ready for approval", color: "bg-violet-500" },
  { status: "in_review", label: "In review", color: "bg-rose-400" },
  { status: "changes_requested", label: "Changes requested", color: "bg-accent-500" },
  { status: "draft", label: "Draft", color: "bg-stone-300" },
];

export default function Home() {
  const state = useAppState();
  const router = useRouter();
  const [templates, setTemplates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState<"all" | "30">("all");
  const [now] = useState(() => Date.now());
  if (!state) return <Skeleton />;

  const brand = activeBrand(state);
  const items = brandItems(state);
  const byUpdated = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const attention = byUpdated.filter((i) => i.status !== "approved" && (openFindingCounts(i).open > 0 || i.status === "ready_for_approval" || i.status === "changes_requested")).slice(0, 4);
  const queue = byUpdated.filter((i) => i.status === "ready_for_approval" || i.status === "in_review");
  const activity = workspaceActivity(state, 5);
  const since = now - 30 * 86400000;
  const inPeriod = period === "all" ? items : items.filter((i) => new Date(i.updatedAt).getTime() >= since);
  const issues = topIssues(inPeriod).slice(0, 5);
  const statusCounts = STATUS_BAR.map((s) => ({ ...s, n: inPeriod.filter((i) => i.status === s.status).length }));
  const totalStatus = statusCounts.reduce((n, s) => n + s.n, 0);
  const activeFacts = brand.facts.filter((f) => factState(f) === "active");
  const lastVerified = [...brand.facts].map((f) => f.lastVerified).sort().pop();
  const userItems = items.filter((i) => !i.seeded);

  const steps = [
    { label: "Add brand guidelines", done: brand.rules.length > 0, href: "/guidelines" },
    { label: "Add a reference logo", done: !!brand.logo, href: "/assets" },
    { label: "Review sample content", done: userItems.some((i) => i.runs.length > 0), href: "/content/new?example=A" },
    { label: "Test a guideline change", done: state.conflicts.some((c) => c.brandId === brand.id && c.impact) || brand.changes.some((c) => c.impact), href: "/guidelines" },
  ];
  const doneSteps = steps.filter((s) => s.done).length;

  const openSample = async () => {
    setBusy(true);
    try {
      // The sample post carries a fictional product image, analysed in the browser like any upload.
      const image = await analyzeUrl("/demo/northstar-jar.svg", "northstar-daily-protein.svg").catch(() => undefined);
      const id = createFromExample("A", image ? { hasImage: true, image, altText: "A hand-drawn tub of Northstar Daily Protein on an oat-coloured background" } : {});
      router.push(`/content/${id}`);
    } finally {
      setBusy(false);
    }
  };

  const guidelineRows = [
    { icon: BookOpen, title: "Brand voice", sub: brand.rules[0]?.text.replace(/\.$/, "") ?? "No rules yet", href: "/guidelines", tint: "bg-sky-50 text-sky-600" },
    { icon: Quote, title: "Approved facts", sub: `${activeFacts.length} active facts${lastVerified ? ` · last verified ${new Date(lastVerified).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}`, href: "/facts", tint: "bg-emerald-50 text-emerald-600" },
    { icon: Palette, title: "Visual identity", sub: `${brand.palette.length} colours${brand.logo ? " · reference logo" : ""}`, href: "/assets", tint: "bg-rose-50 text-rose-600" },
    { icon: ShieldCheck, title: "Rules and terminology", sub: `${brand.rules.length} rules · ${brand.bannedTerms.length} banned, ${brand.preferredTerms.length} preferred terms`, href: "/guidelines", tint: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] [&>*]:min-w-0">
      <div className="space-y-10">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-[radial-gradient(120%_120%_at_100%_0%,#ffedd5_0%,#fbf8f4_55%)] px-6 py-8 md:px-10 md:py-10">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-700">Your brand guardian</p>
              <h1 className="mt-3 font-serif text-5xl leading-[1.02] tracking-tight text-stone-950 md:text-[58px]">
                Create with <em>confidence.</em>
              </h1>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-stone-600">
                Plumbline Jury reviews your content against {brand.name}’s guidelines, approved facts and compliance rules before it goes out.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/content/new" data-tour="create-cta" className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent-600 px-5 text-[14px] font-medium text-white shadow-[0_1px_2px_rgb(234_88_12/0.3)] transition-colors hover:bg-accent-700">
                  <PenLine size={16} /> Create new content <ArrowRight size={15} />
                </Link>
                <button onClick={() => setTemplates(true)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 text-[14px] font-medium text-stone-800 shadow-soft transition-colors hover:border-stone-300">
                  <LayoutTemplate size={16} /> Browse templates
                </button>
              </div>
            </div>
            <div className="hidden justify-end md:flex">
              <HeroPreview onOpen={openSample} busy={busy} />
            </div>
          </div>
          <button onClick={openSample} className="mt-5 text-[13px] font-medium text-accent-700 hover:underline md:hidden">
            Open a reviewed sample post →
          </button>
        </section>

        {/* Needs your attention */}
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-serif text-[26px] leading-none text-stone-950">Needs your attention</h2>
            <Link href="/reviews" className="flex items-center gap-1 text-[13px] text-stone-600 hover:text-stone-900">View all <ArrowRight size={14} /></Link>
          </div>
          {attention.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 py-10 text-center text-[14px] text-stone-500">Nothing needs attention right now.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              {attention.map((i) => {
                const f = openFindingCounts(i);
                return (
                  <Link key={i.id} href={`/content/${i.id}`} className="group flex flex-col rounded-2xl border border-stone-200/80 bg-white p-4 shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lift">
                    <div className="flex items-start gap-3">
                      <TypeIcon type={i.contentType} />
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium text-stone-900">{i.title.replace(/^Demo [A-C]: /, "")}</div>
                        <div className={cx("text-[13px]", f.high ? "text-red-600" : "text-stone-500")}>{findingLabel(i)}</div>
                      </div>
                    </div>
                    <ContentThumb item={i} className="mt-3 h-28" />
                    <div className="mt-3 flex items-center gap-2 text-[12px] text-stone-500">
                      <Initial name={roleMeta(i.createdBy ?? "creator").person} dark />
                      <span className="truncate text-stone-700">{personName(roleMeta(i.createdBy ?? "creator").person)}</span>
                      <span>{timeAgo(i.updatedAt)}</span>
                      <StatusBadge status={i.status} className="ml-auto" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Activity + guidelines */}
        <div className="grid gap-8 lg:grid-cols-2 [&>*]:min-w-0">
          <section>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="font-serif text-[26px] leading-none text-stone-950">Recent activity</h2>
              <Link href="/activity" className="flex items-center gap-1 text-[13px] text-stone-600 hover:text-stone-900">View all <ArrowRight size={14} /></Link>
            </div>
            <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200/80 bg-white shadow-soft">
              {activity.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-stone-500">No activity yet.</li>}
              {activity.map((a, idx) => (
                <li key={idx}>
                  <Link href={a.href ?? "/activity"} className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-stone-50">
                    <Initial name={a.by} />
                    <span className="min-w-0 flex-1 text-[13px]">
                      <span className="line-clamp-2 text-stone-800">
                        <strong className="font-medium text-stone-950">{personName(a.by)}</strong>{" "}
                        {a.kind === "comment" ? "commented on" : ""} {a.kind === "comment" ? <strong className="font-medium">{a.itemTitle}</strong> : a.text.charAt(0).toLowerCase() + a.text.slice(1)}
                      </span>
                      {a.kind === "comment" ? (
                        <span className="block truncate text-stone-500">“{a.text}”</span>
                      ) : (
                        a.itemTitle && <span className="block truncate text-stone-500">{a.itemTitle}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[12px] text-stone-400">{timeAgo(a.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="font-serif text-[26px] leading-none text-stone-950">Brand guidelines</h2>
              <Link href="/guidelines" className="flex items-center gap-1 text-[13px] text-stone-600 hover:text-stone-900">View all <ArrowRight size={14} /></Link>
            </div>
            <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200/80 bg-white shadow-soft">
              {guidelineRows.map((g) => (
                <li key={g.title}>
                  <Link href={g.href} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-stone-50">
                    <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", g.tint)}>
                      <g.icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-stone-900">{g.title}</span>
                      <span className="block truncate text-[13px] text-stone-500">{g.sub}</span>
                    </span>
                    <ChevronRight size={16} className="text-stone-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Right rail */}
      <aside className="space-y-5">
        <section className={RAIL_CARD}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[16px] font-medium text-stone-950">Review queue</h2>
              <p className="text-[13px] text-stone-500">{queue.length} pending</p>
            </div>
            <Link href="/approvals" className="flex items-center gap-1 text-[13px] text-stone-600 hover:text-stone-900">View all <ArrowRight size={13} /></Link>
          </div>
          <ul className="mt-3 space-y-1">
            {queue.length === 0 && <li className="py-4 text-center text-[13px] text-stone-500">Queue is empty.</li>}
            {queue.slice(0, 4).map((i) => (
              <li key={i.id}>
                <Link href={`/content/${i.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-stone-50">
                  {i.meta.image || i.meta.video ? <ContentThumb item={i} className="h-10 !w-10 shrink-0" /> : <TypeIcon type={i.contentType} size={40} />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-stone-900">{i.title.replace(/^Demo [A-C]: /, "")}</span>
                    <span className="block text-[12px] text-stone-500">{findingLabel(i)}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-stone-400">{timeAgo(i.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={RAIL_CARD}>
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-medium text-stone-950">Approval status</h2>
            <select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value as "all" | "30")} className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[12px] text-stone-700">
              <option value="all">All time</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-stone-100" role="img" aria-label="Content by status">
            {statusCounts.map((s) => (totalStatus ? <span key={s.status} className={s.color} style={{ width: `${(s.n / totalStatus) * 100}%` }} /> : null))}
          </div>
          <ul className="mt-4 space-y-2">
            {statusCounts.map((s) => (
              <li key={s.status}>
                <Link href={`/content?status=${s.status}`} className="flex items-center gap-2 text-[13px] text-stone-700 hover:text-stone-950">
                  <span className={cx("h-2.5 w-2.5 rounded-full", s.color)} /> {s.label}
                  <span className="ml-auto tabular-nums text-stone-900">{s.n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={RAIL_CARD}>
          <h2 className="text-[16px] font-medium text-stone-950">Top issues</h2>
          <p className="text-[13px] text-stone-500">{period === "all" ? "All time" : "Last 30 days"}</p>
          <ul className="mt-3 space-y-2.5">
            {issues.length === 0 && <li className="text-[13px] text-stone-500">No findings yet.</li>}
            {issues.map((g) => (
              <li key={g.label} className="flex items-center gap-2.5 text-[13px] text-stone-700">
                <span className={cx("h-2.5 w-2.5 rounded-full", g.color)} /> {g.label}
                <span className="ml-auto tabular-nums text-stone-900">{g.count}</span>
              </li>
            ))}
          </ul>
          <Link href="/insights" className="mt-3 inline-flex items-center gap-1 text-[13px] text-stone-600 hover:text-stone-900">See insights <ArrowRight size={13} /></Link>
        </section>

        <section className="rounded-2xl border border-accent-200/70 bg-accent-50/60 p-5">
          <h2 className="text-[16px] font-medium text-stone-950">Get started</h2>
          <p className="text-[13px] text-stone-500">{doneSteps} of {steps.length} completed</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-accent-600 transition-all" style={{ width: `${(doneSteps / steps.length) * 100}%` }} />
          </div>
          <ul className="mt-3 space-y-0.5">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-2.5 rounded-lg py-1.5 text-[13px] text-stone-800 hover:text-stone-950">
                  <span className={cx("flex h-5 w-5 items-center justify-center rounded-full", s.done ? "bg-accent-600 text-white" : "border border-stone-300 bg-white")}>
                    {s.done && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className={cx("flex-1", s.done && "text-stone-500")}>{s.label}</span>
                  <ChevronRight size={14} className="text-stone-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="flex items-center gap-1.5 px-1 text-[12px] text-stone-500">
          <FileText size={13} /> {brand.fictional ? "Northstar is fictional demo data." : "Data stays in this browser."}
        </p>
      </aside>

      <TemplatesModal open={templates} onClose={() => setTemplates(false)} />
    </div>
  );
}
