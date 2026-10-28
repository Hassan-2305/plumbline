"use client";

import { ArrowLeftRight, Check, X } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, Label, cx, fmtDate, inputCls } from "@/components/ui";
import { activeBrand, decideConflict } from "@/lib/store";
import { computeInsights } from "@/lib/insights";
import type { AppState, GuidelineConflict } from "@/lib/types";
import { RoleNote } from "./RoleNote";
import { ImpactBadge, ImpactPanel } from "./ImpactPanel";
import { applyClarification } from "@/lib/engine/impact";

export function ConflictCard({ c, state, tour }: { c: GuidelineConflict; state: AppState; tour?: boolean }) {
  const brand = activeBrand(state);
  const [text, setText] = useState(c.proposedText);
  const [note, setNote] = useState("");
  const ins = computeInsights(state, true);
  const stat = (id: string) => [...ins.topFlagged, ...ins.confusing].find((r) => r.ruleId === id);
  const target = brand.rules.find((r) => r.id === c.proposedRuleId);
  const resolved = c.status !== "open";
  const reviewer = state.role === "reviewer";

  return (
    <Card className={cx("p-5", !resolved && "border-amber-300")}>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="font-semibold text-stone-950">{c.ruleIds[0]} ↔ {c.ruleIds[1]}</span>
        <Badge tone={resolved ? (c.status === "approved" ? "green" : "neutral") : "amber"}>
          {c.status === "open" ? "Needs decision" : c.status === "approved" ? "Revision approved" : "Revision rejected"}
        </Badge>
        {c.status === "approved" && c.impact && <ImpactBadge impact={c.impact} />}
        <span className="text-[11px] text-stone-500 ml-auto">Detected by: {c.detectedBy}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] items-stretch">
        {c.ruleIds.map((id, i) => {
          const r = brand.rules.find((x) => x.id === id);
          // Show the wording that was in force when the conflict was raised.
          const shown = resolved && c.status === "approved" && id === c.proposedRuleId ? r?.history[r.history.length - 1]?.text ?? r?.text : r?.text;
          const s = stat(id);
          return [
            <div key={id} className="rounded-md border border-stone-200 bg-stone-50 p-3">
              <div className="text-xs font-semibold text-stone-900">
                {id} · {r?.title} <span className="font-normal text-stone-500">v{r?.version}</span>
              </div>
              <p className="mt-1 text-sm text-stone-800">“{shown}”</p>
              {s && (
                <p className="mt-2 text-[11px] text-stone-600">
                  Flagged {s.flagged}× · dismissed {s.dismissed}× · “Rule unclear” {s.unclear}×
                </p>
              )}
            </div>,
            i === 0 ? <ArrowLeftRight key="sep" size={18} className="self-center justify-self-center text-amber-600" /> : null,
          ];
        })}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
        <div>
          <h4 className="text-[11px] font-medium text-stone-500 mb-1">Why they may conflict</h4>
          <p className="text-stone-700">{c.why}</p>
        </div>
        <div>
          <h4 className="text-[11px] font-medium text-stone-500 mb-1">Where ambiguity matters</h4>
          <p className="text-stone-700">{c.exampleContext}</p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-stone-200 p-3">
        <Label htmlFor={`prop-${c.id}`}>
          Proposed clarification — replaces {c.proposedRuleId} “{target?.title}” {resolved ? "" : "(editable)"}
        </Label>
        {resolved ? (
          <p className="text-sm text-stone-800">“{c.proposedText}”</p>
        ) : (
          <textarea id={`prop-${c.id}`} className={inputCls} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        )}
        {resolved ? (
          <p className="mt-2 text-xs text-stone-600">
            {c.status === "approved" ? `Approved — ${c.proposedRuleId} updated; previous text preserved in rule history.` : "Rejected — guidelines unchanged."}{" "}
            {c.decidedAt && fmtDate(c.decidedAt)}
            {c.decisionNote && ` · “${c.decisionNote}”`}
          </p>
        ) : (
          <>
            <div className="mt-3">
              <ImpactPanel propose={(b) => applyClarification(b, c.proposedRuleId, text.trim() || c.proposedText)} target={{ conflictId: c.id }} saved={c.impact} tour={tour} />
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor={`note-${c.id}`}>Decision note (optional)</Label>
                <input id={`note-${c.id}`} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <Button variant="primary" disabled={!text.trim() || !reviewer} onClick={() => decideConflict(c.id, "approved", text.trim(), note.trim())}>
                <Check size={14} /> Approve Revision
              </Button>
              <Button disabled={!reviewer} onClick={() => decideConflict(c.id, "rejected", c.proposedText, note.trim())}>
                <X size={14} /> Reject Revision
              </Button>
            </div>
            <div className="mt-2">
              <RoleNote role={state.role} action="approve or reject a guideline revision" />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
