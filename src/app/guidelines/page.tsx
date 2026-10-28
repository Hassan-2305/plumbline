"use client";

import { useState } from "react";
import { PageHeader, Skeleton, Tabs } from "@/components/ui";
import { activeBrand, brandConflicts, useAppState } from "@/lib/store";
import { ConflictCard } from "@/components/guidelines/ConflictCard";
import { ConflictAnalysis } from "@/components/guidelines/ConflictAnalysis";
import { RulesSection } from "@/components/guidelines/RulesSection";
import { ChangeQueue, Changelog } from "@/components/guidelines/ChangeQueue";

type Tab = "conflicts" | "rules" | "history";

export default function GuidelinesPage() {
  const state = useAppState();
  const [tab, setTab] = useState<Tab | null>(null);
  if (!state) return <Skeleton />;
  const brand = activeBrand(state);
  const open = brandConflicts(state).filter((c) => c.status === "open");
  const decided = brandConflicts(state).filter((c) => c.status !== "open");
  const pending = brand.changes.filter((c) => c.status === "pending").length;
  // Open the tab that needs a decision first.
  const current: Tab = tab ?? (open.length || pending ? "conflicts" : "rules");

  return (
    <div>
      <PageHeader
        title="Guidelines"
        description={
          <>
            The rules every review cites{brand.fictional && " (fictional demo data)"}. Anyone can propose a change; a reviewer approves it after testing its impact. Earlier wording is
            always kept.
          </>
        }
      />
      <Tabs
        label="Guidelines"
        value={current}
        onChange={setTab}
        tabs={[
          { id: "conflicts", label: `Conflicts and proposals${open.length + pending ? ` ${open.length + pending}` : ""}` },
          { id: "rules", label: `Rules ${brand.rules.length}` },
          { id: "history", label: "Change history" },
        ]}
      />
      <div className="space-y-10 pt-6" role="tabpanel">
        {current === "conflicts" && (
          <>
            <ChangeQueue state={state} />
            <section aria-label="Conflicting rules">
              <h2 className="text-[13px] font-semibold text-stone-900">Conflicting rules</h2>
              <p className="mb-3 mt-0.5 max-w-2xl text-[13px] text-stone-500">
                Rules a writer can’t satisfy at the same time, found by a rule-based check or optional AI analysis. Test a clarification against past reviews before approving it.
              </p>
              <div className="space-y-4">
                {open.map((c, i) => (
                  <div key={c.id} data-tour={i === 0 ? "conflict" : undefined}>
                    <ConflictCard c={c} state={state} tour={i === 0} />
                  </div>
                ))}
                {open.length === 0 && (
                  <p data-tour="conflict" className="border-y border-stone-200 py-6 text-center text-[13px] text-stone-500">
                    No open conflicts.
                  </p>
                )}
                {decided.map((c) => (
                  <ConflictCard key={c.id} c={c} state={state} />
                ))}
              </div>
              <ConflictAnalysis state={state} />
            </section>
          </>
        )}
        {current === "rules" && <RulesSection state={state} />}
        {current === "history" && <Changelog state={state} />}
      </div>
    </div>
  );
}
