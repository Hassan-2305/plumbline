"use client";

import { PageHeader, Skeleton } from "@/components/ui";
import { useAppState } from "@/lib/store";
import { TermsSection } from "@/components/guidelines/TermsSection";

export default function AssetsPage() {
  const state = useAppState();
  if (!state) return <Skeleton />;
  return (
    <div>
      <PageHeader title="Brand assets" description="Terminology, the approved colour palette and the reference logo that reviews check against." />
      <TermsSection state={state} />
    </div>
  );
}
