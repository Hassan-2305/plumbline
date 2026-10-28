"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, SectionTitle, fmtDate, inputCls } from "@/components/ui";
import { activeBrand, decideChange, describeChange } from "@/lib/store";
import { Diff } from "../review/VersionsPanel";
import type { AppState, GuidelineChange } from "@/lib/types";
import { RULE_ROLES } from "@/lib/types";
import { RoleNote } from "./RoleNote";
import { ImpactPanel } from "./ImpactPanel";
import { applyChange } from "@/lib/engine/impact";

function ChangeRow({ c, state }: { c: GuidelineChange; state: AppState }) {
  const brand = activeBrand(state);
  const [note, setNote] = useState("");
  const rule = c.ruleId ? brand.rules.find((r) => r.id === c.ruleId) : undefined;
  const reviewer = state.role === "reviewer";
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium capitalize text-stone-900">{describeChange(c)}</span>
        <Badge tone="amber">Pending</Badge>
        <span className="ml-auto text-[11px] text-stone-500">
          {c.proposedBy} · {fmtDate(c.proposedAt)}
        </span>
      </div>
      {c.kind === "rule_edit" && rule && c.text && (
        <div className="rounded border border-stone-200 bg-stone-50 p-2">
          <Diff before={rule.text} after={c.text} />
        </div>
      )}
      {c.kind === "rule_add" && <p className="text-sm text-stone-800">“{c.text}”</p>}
      {c.kind === "banned_add" && c.replacement && <p className="text-xs text-stone-600">Suggested replacement: “{c.replacement}”</p>}
      <p className="text-xs text-stone-600">
        <strong>Reason:</strong> {c.reason}
        {c.role && <> · <strong>Check category:</strong> {RULE_ROLES.find((r) => r.role === c.role)?.label}</>}
      </p>
      <ImpactPanel propose={(b) => applyChange(b, c)} target={{ changeId: c.id }} saved={c.impact} />
      {reviewer ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={inputCls} placeholder="Decision note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" variant="primary" className="h-9" onClick={() => decideChange(c.id, "approved", note.trim())}>
            <Check size={13} /> Approve
          </Button>
          <Button size="sm" className="h-9" onClick={() => decideChange(c.id, "rejected", note.trim())}>
            <X size={13} /> Reject
          </Button>
        </div>
      ) : (
        <RoleNote role={state.role} action="approve guideline changes" />
      )}
    </div>
  );
}

export function ChangeQueue({ state }: { state: AppState }) {
  const brand = activeBrand(state);
  const pending = brand.changes.filter((c) => c.status === "pending");
  if (!pending.length) return null;
  return (
    <section id="queue">
      <SectionTitle aside={<Badge tone="orange">{pending.length} pending</Badge>}>Proposed guideline changes</SectionTitle>
      <Card className="divide-y divide-stone-100 border-orange-300">
        {pending.map((c) => (
          <ChangeRow key={c.id} c={c} state={state} />
        ))}
      </Card>
    </section>
  );
}

export function Changelog({ state }: { state: AppState }) {
  const brand = activeBrand(state);
  const decided = brand.changes.filter((c) => c.status !== "pending");
  const log = [...(brand.changelog ?? [])].reverse();
  return (
    <section id="changelog">
      <SectionTitle>Guideline change log</SectionTitle>
      <Card className="p-4">
        {log.length === 0 ? (
          <p className="text-sm text-stone-600">No changes since the demo was loaded. Approved and rejected proposals appear here.</p>
        ) : (
          <ul className="space-y-1.5">
            {log.map((e, i) => (
              <li key={i} className="text-xs text-stone-700">
                <span className="text-stone-400">{fmtDate(e.at)}</span> · <span className="font-medium">{e.by}</span> — {e.text}
              </li>
            ))}
          </ul>
        )}
        {decided.length > 0 && (
          <p className="mt-3 text-[11px] text-stone-500">
            {decided.filter((c) => c.status === "approved").length} proposal(s) approved, {decided.filter((c) => c.status === "rejected").length} rejected.
          </p>
        )}
        <p className="mt-2 text-[11px] text-stone-500">Stored in this browser only. This is not a tamper-proof audit trail.</p>
      </Card>
    </section>
  );
}
