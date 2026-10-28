"use client";

import { AlertTriangle, Check, CircleDot, Lock, ShieldCheck, Undo2 } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, Label, SectionTitle, SeverityBadge, StatusBadge, cx, fmtDate, inputCls } from "@/components/ui";
import { approvalRights, decideApproval, setRole, submitForApproval } from "@/lib/store";
import { can, roleMeta, ROLES } from "@/lib/roles";
import type { ContentItem, Role } from "@/lib/types";

/** Approval workflow for creators, managers and authorised reviewers (simulated roles). */
export function ApprovalPanel({ item, role, onRerun }: { item: ContentItem; role: Role; onRerun: () => void }) {
  const [note, setNote] = useState("");
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const rights = approvalRights(item, role);
  const latest = item.versions[item.versions.length - 1];
  const reviewedCurrent = item.runs.some((r) => r.versionNumber === latest.number) && latest.text === item.text;
  const openCount = item.findings.filter((f) => f.status === "open" || f.status === "escalated").length;
  const needsOverride = !rights.canApproveClean && rights.canOverride;
  const approveEnabled = rights.canApproveClean || (needsOverride && override && overrideReason.trim().length > 3);
  const flagged = [...rights.blockers, ...rights.escalated.filter((e) => !rights.blockers.includes(e))];

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-stone-900">Status</span>
          <StatusBadge status={item.status} />
          <span className="text-xs text-stone-500">v{latest.number}</span>
          <span className="ml-auto text-xs text-stone-500">
            Acting as <strong className="text-stone-800">{roleMeta(role).person}</strong>
          </span>
        </div>

        <div className="mt-3">
          {flagged.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-red-800">
                <AlertTriangle size={15} /> {flagged.length} finding{flagged.length > 1 ? "s" : ""} need an authorised reviewer
              </div>
              <ul className="mt-2 space-y-1">
                {flagged.map((b) => (
                  <li key={b.id} className="flex items-center gap-1.5 text-xs text-red-900">
                    <SeverityBadge s={b.severity} />
                    <a href={`#${b.id}`} className="font-mono underline">{b.id}</a> {b.title}
                    {b.status === "escalated" && <Badge tone="orange">Escalated</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-emerald-800">
              <Check size={15} /> No high-risk or escalated findings{openCount ? ` (${openCount} lower-risk still open)` : ""}.
            </p>
          )}
        </div>

        {/* Creator: submit */}
        {item.status !== "under_review" && item.status !== "approved" && can(role, "content.submit") && (
          <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
            <Button variant="primary" disabled={!reviewedCurrent} onClick={() => submitForApproval(item.id)}>
              Submit v{latest.number} for approval
            </Button>
            {!reviewedCurrent && (
              <p className="text-xs text-stone-500">
                The current text hasn’t been reviewed yet.{" "}
                <button className="text-orange-700 underline" onClick={onRerun}>Re-run jury review</button>, then submit.
              </p>
            )}
          </div>
        )}

        {item.status === "approved" && (
          <p className="mt-4 border-t border-stone-100 pt-4 text-sm text-stone-600">This version is approved. Editing the text returns it to Draft.</p>
        )}

        {/* Manager / reviewer: decide */}
        {item.status === "under_review" && (
          <div className="mt-4 space-y-3 border-t border-stone-100 pt-4">
            {!can(role, "content.approve") ? (
              <p className="text-sm text-stone-600">Submitted. Waiting for a manager or reviewer to decide.</p>
            ) : (
              <>
                <div>
                  <Label htmlFor="decision-note">Decision note</Label>
                  <textarea id="decision-note" className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                {needsOverride && (
                  <div className="space-y-2 rounded-lg border border-stone-200 p-3">
                    <label className="flex items-center gap-2 text-sm text-stone-800">
                      <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                      Override {flagged.length} finding{flagged.length > 1 ? "s" : ""} as the authorised reviewer
                    </label>
                    {override && (
                      <div>
                        <Label htmlFor="override">Override reason (required, recorded in history)</Label>
                        <textarea id="override" className={inputCls} rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                      </div>
                    )}
                  </div>
                )}
                {rights.reason && !needsOverride && <p className="text-xs text-amber-800">{rights.reason}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    disabled={!approveEnabled}
                    onClick={() => decideApproval(item.id, "approved", note.trim(), needsOverride ? overrideReason.trim() : undefined)}
                  >
                    {!approveEnabled ? <Lock size={13} /> : <ShieldCheck size={13} />} Approve v{latest.number}
                  </Button>
                  {rights.canRequestChanges && (
                    <Button variant="danger" onClick={() => decideApproval(item.id, "changes_requested", note.trim())}>
                      <Undo2 size={13} /> Request changes
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-3 text-xs text-stone-500">
          Switch role (simulated):
          {ROLES.filter((r) => r.id !== role).map((r) => (
            <button key={r.id} onClick={() => setRole(r.id)} className="rounded-full border border-stone-200 px-2 py-0.5 text-stone-700 hover:bg-stone-50">
              {r.label}
            </button>
          ))}
        </div>
      </Card>

      <p className="text-xs text-stone-500">
        Managers can approve when nothing high-risk or escalated is open. Only an authorised reviewer can override, and the reason is recorded. Approval applies only
        inside Plumbline Jury; it can’t block publishing on external platforms.
      </p>

      <div>
        <SectionTitle>Approval history</SectionTitle>
        {item.approvals.length === 0 && <p className="text-xs text-stone-500">No decisions yet.</p>}
        <ul className="space-y-1.5">
          {[...item.approvals].reverse().map((a, i) => (
            <li key={i} className="flex gap-2 text-xs text-stone-700">
              <CircleDot size={13} className={cx("mt-0.5 shrink-0", a.decision === "approved" ? "text-emerald-600" : "text-red-600")} />
              <span>
                <strong>{a.decision === "approved" ? "Approved" : "Changes requested"}</strong> v{a.versionNumber} by {a.reviewer} · {fmtDate(a.at)}
                {a.note && <> — “{a.note}”</>}
                {a.overriddenFindingIds.length > 0 && (
                  <span className="block text-orange-800">Overrode {a.overriddenFindingIds.join(", ")}: “{a.overrideReason}”</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
