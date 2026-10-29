"use client";

import { Check, ChevronRight, Loader2, Lock, Play, Send, ShieldCheck, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Label, Modal, cx, inputCls } from "@/components/ui";
import { Avatar } from "@/components/content/ContentList";
import { approvalRights, decideApproval, setAssignee, setRole, submitForApproval } from "@/lib/store";
import { can, roleMeta } from "@/lib/roles";
import type { ContentItem, ContentStatus, Role } from "@/lib/types";

const firstName = (r: Role) => roleMeta(r).person.replace(/\s*\(.*\)/, "");

const STEPS: { status: ContentStatus; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "in_review", label: "In review" },
  { status: "changes_requested", label: "Changes requested" },
  { status: "ready_for_approval", label: "Ready for approval" },
  { status: "approved", label: "Approved" },
];

function Lifecycle({ status }: { status: ContentStatus }) {
  const order: Record<ContentStatus, number> = { draft: 0, in_review: 1, changes_requested: 2, ready_for_approval: 3, approved: 4 };
  const cur = order[status];
  return (
    <ol data-tour="stepper" aria-label="Lifecycle" className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[12px]">
      {STEPS.map((s, i) => {
        // "Changes requested" is a detour: only show it as reached when it is the current state.
        const reached = s.status === "changes_requested" ? status === "changes_requested" : order[s.status] < cur || s.status === status;
        const current = s.status === status;
        return (
          <li key={s.status} className="flex items-center gap-1" aria-current={current ? "step" : undefined}>
            {i > 0 && <ChevronRight size={12} className="text-stone-300" />}
            <span
              className={cx(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors",
                current ? "bg-stone-900 text-white" : reached ? "text-stone-800" : "text-stone-400",
              )}
            >
              {reached && !current && <Check size={11} />}
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function DecisionBar({
  item,
  title,
  onTitle,
  role,
  confidential,
  reviewedCurrent,
  dirty,
  running,
  onRun,
}: {
  item?: ContentItem;
  title: string;
  onTitle: (t: string) => void;
  role: Role;
  confidential: boolean;
  reviewedCurrent: boolean;
  dirty: boolean;
  running: boolean;
  onRun: () => void;
}) {
  const [dialog, setDialog] = useState<"approve" | "changes" | null>(null);
  const [note, setNote] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const rights = item ? approvalRights(item, role) : null;
  const status: ContentStatus = item?.status ?? "draft";
  const latest = item?.versions[item.versions.length - 1];
  const needsOverride = !!rights && !rights.canApproveClean && rights.canOverride;
  const flagged = rights ? [...rights.blockers, ...rights.escalated.filter((e) => !rights.blockers.includes(e))] : [];
  const canSubmit = !!item && can(role, "content.submit") && ["in_review", "changes_requested", "draft"].includes(status);
  const canDecide = !!item && status === "ready_for_approval" && can(role, "content.approve");

  const close = () => {
    setDialog(null);
    setNote("");
    setOverrideReason("");
  };

  return (
    <div className="border-b border-stone-200 pb-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-stone-500">
        <Link href="/content" className="hover:text-stone-900">Content</Link>
        <ChevronRight size={12} />
        <span className="truncate text-stone-700">{title || "Untitled draft"}</span>
        {item?.seeded && <Badge tone="amber">Seeded demo history</Badge>}
        {confidential && (
          <Badge tone="dark">
            <Lock size={10} /> Confidential
          </Badge>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          aria-label="Title"
          value={title}
          placeholder="Untitled draft"
          onChange={(e) => onTitle(e.target.value)}
          className="-mx-1 min-w-0 flex-1 basis-full rounded px-1 text-lg font-semibold sm:basis-auto tracking-tight text-stone-950 placeholder:text-stone-300 hover:bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-100"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onRun} disabled={running} variant={item?.runs.length ? "secondary" : "primary"}>
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {running ? "Reviewing…" : item?.runs.length ? (dirty ? "Re-review edits" : "Re-run review") : "Run review"}
          </Button>
          {canSubmit && (
            <Button
              variant="primary"
              disabled={!reviewedCurrent}
              title={reviewedCurrent ? undefined : "Run the review on the current text first"}
              onClick={() => submitForApproval(item!.id)}
            >
              <Send size={13} /> Submit for approval
            </Button>
          )}
          {canDecide && (
            <>
              {rights!.canRequestChanges && (
                <Button onClick={() => setDialog("changes")}>
                  <Undo2 size={13} /> Request changes
                </Button>
              )}
              <Button variant="primary" disabled={!rights!.canApproveClean && !rights!.canOverride} title={rights!.reason} onClick={() => setDialog("approve")}>
                <ShieldCheck size={13} /> Approve
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <Lifecycle status={status} />
        {item && (
          <div className="flex items-center gap-3 text-[12px] text-stone-600">
            <span className="flex items-center gap-1.5">
              <Avatar role={item.createdBy} size={18} /> {roleMeta(item.createdBy ?? "creator").person.replace(/\s*\(.*\)/, "")}
            </span>
            <ChevronRight size={12} className="text-stone-300" />
            <label className="flex items-center gap-1.5">
              <span className="sr-only">Assigned reviewer</span>
              <Avatar role={item.assignee} size={18} />
              <select
                value={item.assignee ?? "manager"}
                onChange={(e) => setAssignee(item.id, e.target.value as Role)}
                className="rounded border-0 bg-transparent py-0 pl-0 pr-5 text-[12px] text-stone-700 hover:bg-stone-100 focus:ring-2 focus:ring-accent-100"
              >
                <option value="manager">Marcus (Manager)</option>
                <option value="reviewer">Dana (Brand reviewer)</option>
              </select>
            </label>
            {latest && <span className="text-stone-400">v{latest.number}</span>}
          </div>
        )}
      </div>
      {canDecide && rights!.reason && !needsOverride && <p className="mt-2 text-[12px] text-amber-800">{rights!.reason}</p>}
      {item && status === "ready_for_approval" && !can(role, "content.approve") && (
        // Everyone in this prototype shares one browser, so nobody else will ever act on it:
        // make switching to the approver the obvious next step.
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-accent-200 bg-accent-50/70 px-4 py-3">
          <Avatar role={item.assignee ?? "manager"} size={28} />
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="font-medium text-stone-900">
              Waiting for {roleMeta(item.assignee ?? "manager").person} to approve v{latest?.number ?? 1}
            </p>
            <p className="text-stone-600">
              {roleMeta(role).person} can’t approve. In this demo you play every role, so switch to {firstName(item.assignee ?? "manager")} to make the decision.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setRole(item.assignee ?? "manager")}>
            <ShieldCheck size={13} /> Switch to {firstName(item.assignee ?? "manager")}
          </Button>
        </div>
      )}

      <Modal
        open={dialog === "approve"}
        onClose={close}
        title={`Approve v${latest?.number ?? 1}`}
        footer={
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button
              variant="primary"
              disabled={needsOverride && overrideReason.trim().length < 4}
              onClick={() => {
                decideApproval(item!.id, "approved", note.trim(), needsOverride ? overrideReason.trim() : undefined);
                close();
              }}
            >
              <ShieldCheck size={13} /> {needsOverride ? "Override and approve" : "Approve"}
            </Button>
          </>
        }
      >
        {needsOverride ? (
          <div className="space-y-3">
            <p className="text-red-800">
              {flagged.length} high-risk or escalated finding{flagged.length > 1 ? "s are" : " is"} still open. As the authorised reviewer you can override; the reason is
              recorded in the history.
            </p>
            <ul className="space-y-1 text-[12px] text-stone-700">
              {flagged.map((f) => (
                <li key={f.id}>
                  <span className="font-mono text-stone-500">{f.id}</span> {f.title}
                </li>
              ))}
            </ul>
            <div>
              <Label htmlFor="override">Override reason (required)</Label>
              <textarea id="override" rows={2} className={inputCls} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
            </div>
          </div>
        ) : (
          <p className="text-stone-700">No high-risk or escalated findings are open. Approval applies to v{latest?.number ?? 1} only; editing the text returns it to review.</p>
        )}
        <div className="mt-3">
          <Label htmlFor="approve-note">Note (optional)</Label>
          <textarea id="approve-note" rows={2} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </Modal>

      <Modal
        open={dialog === "changes"}
        onClose={close}
        title="Request changes"
        footer={
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!note.trim()}
              onClick={() => {
                decideApproval(item!.id, "changes_requested", note.trim());
                close();
              }}
            >
              <Undo2 size={13} /> Send back to creator
            </Button>
          </>
        }
      >
        <Label htmlFor="changes-note">What needs to change? (required)</Label>
        <textarea id="changes-note" rows={3} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </div>
  );
}
