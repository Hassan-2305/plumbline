"use client";

import { FilePlus2 } from "lucide-react";
import { ButtonLink, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { ContentList } from "@/components/content/ContentList";
import { brandItems, useAppState } from "@/lib/store";

/** Work in progress: content being reviewed or sent back for changes. */
export default function ReviewsPage() {
  const state = useAppState();
  if (!state) return <Skeleton />;
  const items = brandItems(state).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const changes = items.filter((i) => i.status === "changes_requested");
  const inReview = items.filter((i) => i.status === "in_review");
  const drafts = items.filter((i) => i.status === "draft");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reviews"
        description="Content being checked by the jury. Resolve findings, then submit for approval."
        actions={
          <ButtonLink href="/content/new" variant="primary">
            <FilePlus2 size={14} /> New content
          </ButtonLink>
        }
      />
      <section>
        <SectionTitle aside={<span className="text-xs tabular-nums text-stone-500">{changes.length}</span>}>Changes requested</SectionTitle>
        <ContentList items={changes} empty="Nothing has been sent back." />
      </section>
      <section>
        <SectionTitle aside={<span className="text-xs tabular-nums text-stone-500">{inReview.length}</span>}>In review</SectionTitle>
        <ContentList items={inReview} empty="No content in review. Run a review on a draft to start." />
      </section>
      {drafts.length > 0 && (
        <section>
          <SectionTitle aside={<span className="text-xs tabular-nums text-stone-500">{drafts.length}</span>}>Drafts not yet reviewed</SectionTitle>
          <ContentList items={drafts} />
        </section>
      )}
    </div>
  );
}
