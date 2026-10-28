"use client";

import {
  AlertTriangle,
  ArrowRight,
  AtSign,
  Undo2,
  BookOpenCheck,
  CheckCircle2,
  FileSearch,
  Gavel,
  GitCompareArrows,
  Inbox,
  Play,
  RotateCcw,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, ButtonLink, Card, IconChip, SectionTitle, Skeleton, Stat, StatusBadge, fmtDate } from "@/components/ui";
import { can, roleMeta } from "@/lib/roles";
import { mentionsFor, activeBrand, createFromExample, loadDemo, resetDemo, unresolvedHighRisk, useAppState, brandItems, brandConflicts } from "@/lib/store";
import { EXAMPLES } from "@/lib/seed/examples";
import { computeInsights } from "@/lib/insights";
import { JURORS } from "@/lib/types";

function HowItWorks() {
  return (
    <div className="relative" aria-hidden>
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-orange-100/70 via-stone-100 to-stone-50" />
      <div className="relative space-y-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
            <IconChip tone="ink"><Gavel size={15} /></IconChip> 1 · Four jurors review the draft
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {JURORS.map((j) => (
              <span key={j} className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] text-stone-700">{j}</span>
            ))}
          </div>
        </Card>
        <Card className="ml-6 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
            <IconChip tone="orange"><ScrollText size={15} /></IconChip> 2 · Every objection cites evidence
          </div>
          <p className="mt-3 text-sm text-stone-800">
            <span className="rounded bg-red-50 px-1 underline decoration-red-500 decoration-2 underline-offset-2">clinically proven to double your results</span>
          </p>
          <p className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
            <strong className="text-stone-900">R-005</strong> · Clinical and health claims require approved supporting evidence. <span className="text-stone-400">No approved fact found.</span>
          </p>
        </Card>
        <Card className="ml-12 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
            <IconChip tone="green"><ShieldCheck size={15} /></IconChip> 3 · A human approves, with history
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Badge tone="green">Approved</Badge>
            <span className="text-stone-600">v4 · 3 fixes accepted · 1 dismissed with reason</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function Overview() {
  const state = useAppState();
  const router = useRouter();
  if (!state) return <Skeleton />;

  const ins = computeInsights(state, true);
  const brand = activeBrand(state);
  const items = brandItems(state);
  const openConflicts = brandConflicts(state).filter((c) => c.status === "open");
  const pendingChanges = brand.changes.filter((c) => c.status === "pending");
  const pendingFacts = brand.facts.filter((f) => f.status === "pending");
  const blocked = items.filter((i) => unresolvedHighRisk(i).length > 0 && !i.seeded);
  const awaiting = can(state.role, "content.approve") ? items.filter((i) => i.status === "under_review") : [];
  const returned = can(state.role, "content.submit") ? items.filter((i) => i.status === "changes_requested" && !i.seeded) : [];
  const mentions = mentionsFor(state, state.role);
  const recent = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const tryDemo = (id: string) => router.push(`/review/${createFromExample(id)}`);

  const attention = [
    ...mentions.slice(0, 3).map(({ item, comment }) => ({
      key: comment.id,
      icon: <AtSign size={15} />,
      tone: "orange" as const,
      title: `${comment.by} mentioned you on “${item.title}”`,
      sub: comment.text,
      href: `/review/${item.id}`,
      cta: "Reply",
    })),
    ...openConflicts.map((c) => ({
      key: c.id,
      icon: <GitCompareArrows size={15} />,
      tone: "orange" as const,
      title: `${c.ruleIds[0]} and ${c.ruleIds[1]} contradict each other`,
      sub: "A clarification is drafted and needs a reviewer decision.",
      href: "/guidelines",
      cta: "Decide",
    })),
    ...blocked.slice(0, 3).map((i) => ({
      key: `blk-${i.id}`,
      icon: <AlertTriangle size={15} />,
      tone: "red" as const,
      title: i.title,
      sub: `${unresolvedHighRisk(i).length} high-risk finding(s) block approval.`,
      href: `/review/${i.id}`,
      cta: "Resolve",
    })),
    ...awaiting.slice(0, 3).map((i) => ({
      key: `await-${i.id}`,
      icon: <Inbox size={15} />,
      tone: "stone" as const,
      title: i.title,
      sub: "Submitted and waiting for your decision.",
      href: `/review/${i.id}`,
      cta: "Decide",
    })),
    ...returned.slice(0, 3).map((i) => ({
      key: `ret-${i.id}`,
      icon: <Undo2 size={15} />,
      tone: "red" as const,
      title: i.title,
      sub: "Changes were requested. Update the draft and resubmit.",
      href: `/review/${i.id}`,
      cta: "Revise",
    })),
    ...(pendingChanges.length + pendingFacts.length
      ? [
          {
            key: "pending",
            icon: <BookOpenCheck size={15} />,
            tone: "stone" as const,
            title: `${pendingChanges.length + pendingFacts.length} guideline proposal(s) pending`,
            sub: "Rule, term or fact changes waiting for approval.",
            href: "/guidelines",
            cta: "Open",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-12">
      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] [&>*]:min-w-0">
        <div>
          <Badge tone="orange" className="mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> {brand.name}{brand.fictional ? " · fictional demo brand loaded" : ` · ${brand.rules.length} rules`}
          </Badge>
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-stone-950 md:text-6xl">
            Publish with evidence, <span className="italic text-stone-500">not opinion.</span>
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-stone-600">
            Plumbline Jury checks marketing content against your brand rules and approved facts before it goes out. Every objection cites evidence, every fix needs
            your consent, and every approval is recorded.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Button variant="accent" size="lg" data-tour="try-demo" onClick={() => tryDemo("A")}>
              <Play size={15} /> Try Demo
            </Button>
            <ButtonLink href="/review/new" size="lg">
              <FileSearch size={15} /> Review Content
            </ButtonLink>
          </div>
          <p className="mt-3 text-xs text-stone-500">Try Demo opens a sample post that’s already reviewed. No sign-up and no setup.</p>
        </div>
        <div className="hidden lg:block">
          <HowItWorks />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <div>
          <SectionTitle aside={attention.length > 0 && <Badge tone="orange">{attention.length}</Badge>}>
            Needs your attention · {roleMeta(state.role).label}
          </SectionTitle>
          <Card className="divide-y divide-stone-100">
            {attention.length === 0 && (
              <div className="flex items-center gap-3 px-4 py-5 text-sm text-stone-600">
                <IconChip tone="green"><CheckCircle2 size={15} /></IconChip> All clear. Nothing is waiting on a decision.
              </div>
            )}
            {attention.slice(0, 5).map((a) => (
              <Link key={a.key} href={a.href} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50">
                <IconChip tone={a.tone}>{a.icon}</IconChip>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-stone-900">{a.title}</span>
                  <span className="block truncate text-xs text-stone-500">{a.sub}</span>
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-stone-500 group-hover:text-stone-900">
                  {a.cta} <ArrowRight size={13} />
                </span>
              </Link>
            ))}
          </Card>
        </div>
        <div>
          <SectionTitle>Try a scenario</SectionTitle>
          <div className="space-y-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                onClick={() => tryDemo(ex.id)}
                className="group w-full rounded-xl border border-stone-200/80 bg-white px-4 py-3 text-left shadow-soft transition hover:border-stone-300 hover:shadow-lift"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-stone-900 text-[10px] font-semibold text-white">{ex.id}</span>
                  <span className="text-sm font-medium text-stone-900">{ex.title}</span>
                  <ArrowRight size={14} className="ml-auto text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-700" />
                </div>
                <p className="mt-1 pl-7 text-xs leading-relaxed text-stone-500">{ex.blurb}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle aside={<span className="text-[11px] text-stone-500">Includes {ins.seededItems} labelled seeded items · {ins.userItems} created by you</span>}>
          At a glance
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Review runs" value={ins.totalReviews} hint={`${ins.itemsReviewed} pieces of content`} icon={<Gavel size={15} />} />
          <Stat label="Open findings" value={ins.openFindings} hint="Open or escalated" icon={<ScrollText size={15} />} />
          <Stat label="High-risk open" value={ins.highRiskOpen} accent={ins.highRiskOpen > 0} hint="These block approval" icon={<AlertTriangle size={15} />} />
          <Stat label="Approved" value={ins.approved} hint="Inside this prototype only" icon={<ShieldCheck size={15} />} />
        </div>
      </section>

      <section>
        <SectionTitle aside={<Link href="/review" className="text-xs font-medium text-stone-500 hover:text-stone-900">View all →</Link>}>Recent content</SectionTitle>
        <Card className="divide-y divide-stone-100">
          {recent.map((it) => {
            const hr = unresolvedHighRisk(it).length;
            return (
              <Link key={it.id} href={`/review/${it.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-stone-900">{it.title}</div>
                  <div className="text-xs text-stone-500">
                    {it.contentType} · {fmtDate(it.updatedAt)} {it.seeded && <span className="text-orange-700">· seeded demo</span>}
                  </div>
                </div>
                {hr > 0 && (
                  <span className="flex items-center gap-1 text-xs text-red-700">
                    <AlertTriangle size={13} /> {hr} high
                  </span>
                )}
                <StatusBadge status={it.status} />
              </Link>
            );
          })}
        </Card>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-stone-500">
          Demo data:
          <button onClick={loadDemo} className="font-medium text-stone-700 underline-offset-2 hover:underline" title="Restore demo brand and seeded history; keep your drafts">
            Load Demo
          </button>
          <button
            onClick={() => confirm("Reset everything to the original demo state? Your drafts will be removed.") && resetDemo()}
            className="inline-flex items-center gap-1 font-medium text-stone-700 underline-offset-2 hover:underline"
          >
            <RotateCcw size={12} /> Reset Demo
          </button>
        </div>
      </section>
    </div>
  );
}
