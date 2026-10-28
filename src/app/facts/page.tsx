"use client";

import { PageHeader, Skeleton } from "@/components/ui";
import { useAppState } from "@/lib/store";
import { FactsSection } from "@/components/guidelines/FactsSection";

export default function FactsPage() {
  const state = useAppState();
  if (!state) return <Skeleton />;
  return (
    <div>
      <PageHeader
        title="Approved facts"
        description="The only statements that can support a claim. New facts start as pending; expired facts can’t support current promotions."
      />
      <FactsSection state={state} />
    </div>
  );
}
