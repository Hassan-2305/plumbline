"use client";

import { PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { ContentList } from "@/components/content/ContentList";
import { brandItems, useAppState } from "@/lib/store";
import { can, roleMeta } from "@/lib/roles";

/** Approval queue for managers and authorised reviewers. */
export default function ApprovalsPage() {
  const state = useAppState();
  if (!state) return <Skeleton />;
  const items = brandItems(state).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const waiting = items.filter((i) => i.status === "ready_for_approval");
  const assignedToMe = waiting.filter((i) => i.assignee === state.role);
  const others = waiting.filter((i) => i.assignee !== state.role);
  const decided = items.filter((i) => i.approvals.length > 0 && (i.status === "approved" || i.status === "changes_requested")).slice(0, 10);
  const me = roleMeta(state.role);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Approvals"
        description={
          can(state.role, "content.approve")
            ? "Content submitted for a decision. Open an item to see its findings, then approve or request changes."
            : `You’re acting as ${me.person}. Creators submit content here; a manager or reviewer decides.`
        }
      />
      <section>
        <SectionTitle aside={<span className="text-xs tabular-nums text-stone-500">{assignedToMe.length}</span>}>Assigned to you</SectionTitle>
        <ContentList items={assignedToMe} empty={can(state.role, "content.approve") ? "Nothing waiting for you." : "Creators don’t approve content."} />
      </section>
      <section>
        <SectionTitle aside={<span className="text-xs tabular-nums text-stone-500">{others.length}</span>}>Waiting on others</SectionTitle>
        <ContentList items={others} empty="Nothing else waiting." />
      </section>
      <section>
        <SectionTitle>Recently decided</SectionTitle>
        <ContentList items={decided} empty="No decisions yet." />
      </section>
    </div>
  );
}
