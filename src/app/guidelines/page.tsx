"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Card, IconChip, PageHeader, Skeleton, Tabs } from "@/components/ui";
import { activeBrand, useAppState, brandConflicts } from "@/lib/store";
import { ConflictCard } from "@/components/guidelines/ConflictCard";
import { ConflictAnalysis } from "@/components/guidelines/ConflictAnalysis";
import { RulesSection } from "@/components/guidelines/RulesSection";
import { FactsSection } from "@/components/guidelines/FactsSection";
import { TermsSection } from "@/components/guidelines/TermsSection";
import { ChangeQueue, Changelog } from "@/components/guidelines/ChangeQueue";

type Tab = "intelligence" | "rules" | "facts" | "assets" | "log";

function Count({ n, alert }: { n: number; alert?: boolean }) {
  if (!n) return null;
  return <span className={alert ? "ml-1.5 rounded-full bg-orange-600 px-1.5 text-[11px] text-white" : "ml-1.5 rounded-full bg-stone-100 px-1.5 text-[11px] text-stone-600"}>{n}</span>;
}

export default function GuidelinesPage() {
  const state = useAppState();
  const [tab, setTab] = useState<Tab>("intelligence");
  if (!state) return <Skeleton />;
  const brand = activeBrand(state);
  const open = brandConflicts(state).filter((c) => c.status === "open");
  const decided = brandConflicts(state).filter((c) => c.status !== "open");
  const pending = brand.changes.filter((c) => c.status === "pending").length;
  const pendingFacts = brand.facts.filter((f) => f.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="Guidelines"
        description={
          <>
            {brand.name}’s rules, approved facts and brand assets.{brand.fictional && <span className="text-orange-700"> All fictional demo data.</span>} Anyone can propose a change, but it
            only takes effect when a reviewer approves it. Earlier wording is always kept.
          </>
        }
      />
      <Tabs
        label="Guideline sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "intelligence", label: <>Conflicts & proposals<Count n={open.length + pending} alert /></> },
          { id: "rules", label: <>Rules<Count n={brand.rules.length} /></> },
          { id: "facts", label: <>Approved facts<Count n={pendingFacts} alert /></> },
          { id: "assets", label: "Terms, palette & logo" },
          { id: "log", label: "Change log" },
        ]}
      />
      <div className="pt-8 space-y-10" role="tabpanel">
        {tab === "intelligence" && (
          <>
            <ChangeQueue state={state} />
            <section aria-label="Guideline Intelligence">
              <div className="mb-4">
                <h2 className="font-serif text-2xl text-stone-950">Guideline Intelligence</h2>
                <p className="mt-1 max-w-3xl text-sm text-stone-600">
                  Rules that may contradict each other, found by a rule-based check or optional AI analysis and backed by review decisions. Nothing changes until a
                  reviewer approves a revision.
                </p>
              </div>
              <div className="space-y-4">
                {open.map((c, i) => (
                  <div key={c.id} data-tour={i === 0 ? "conflict" : undefined}>
                    <ConflictCard c={c} state={state} tour={i === 0} />
                  </div>
                ))}
                {open.length === 0 && (
                  <Card data-tour="conflict" className="flex items-center gap-3 p-5 text-sm text-stone-600">
                    <IconChip tone="green"><CheckCircle2 size={15} /></IconChip> No open conflicts. Earlier decisions are listed below.
                  </Card>
                )}
                {decided.map((c) => (
                  <ConflictCard key={c.id} c={c} state={state} />
                ))}
              </div>
              <ConflictAnalysis state={state} />
            </section>
          </>
        )}
        {tab === "rules" && <RulesSection state={state} />}
        {tab === "facts" && <FactsSection state={state} />}
        {tab === "assets" && <TermsSection state={state} />}
        {tab === "log" && <Changelog state={state} />}
      </div>
    </div>
  );
}
