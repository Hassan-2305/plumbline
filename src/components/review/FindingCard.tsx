"use client";

import { ChevronDown, CornerDownRight, MessageSquare, FileCheck2, Gauge, Info, ScrollText, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, FindingStatusBadge, Label, Modal, SEVERITY_DOT, SeverityBadge, SourceBadge, cx, fmtDate, inputCls } from "@/components/ui";
import { acceptFix, dismissFinding, escalateFinding, reopenFinding } from "@/lib/store";
import type { Brand, Comment, DismissReason, EvidenceRef, Finding } from "@/lib/types";
import { CommentThread } from "./CommentThread";
import { DISMISS_REASONS } from "@/lib/types";
import { factState } from "@/lib/engine/evidence";

export function FindingCard({
  itemId,
  finding: f,
  brand,
  text,
  open,
  onToggle,
  tour,
  readOnly,
  comments,
  page,
}: {
  itemId: string;
  finding: Finding;
  brand: Brand;
  text: string;
  /** Controlled: the workspace keeps one finding open at a time. */
  open: boolean;
  onToggle: () => void;
  /** Marks this card as the walkthrough's example finding. */
  tour?: boolean;
  readOnly?: boolean;
  comments?: Comment[];
  /** Page number when the content is an imported multi-page document. */
  page?: number;
}) {
  const [discussOpen, setDiscussOpen] = useState(false);
  const thread = (comments ?? []).filter((c) => c.findingId === f.id && !c.resolved);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(f.replacement ?? f.offendingText ?? "");
  const [dismissOpen, setDismissOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [reason, setReason] = useState<DismissReason>("False positive");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resolved = f.status !== "open";
  const textPresent = !!f.offendingText && text.toLowerCase().includes(f.offendingText.toLowerCase());
  const canAccept = !resolved && textPresent && !f.location && f.replacement !== undefined;
  const canEdit = !resolved && textPresent && !f.location;
  const last = f.history[f.history.length - 1];

  const doAccept = (override?: string) => {
    const err = acceptFix(itemId, f.id, override);
    setError(err);
    if (!err) setEditing(false);
  };

  return (
    <article
      id={f.id}
      data-tour={tour ? "finding" : undefined}
      className={cx(
        "scroll-mt-24 rounded-xl border bg-white transition-shadow",
        open ? "border-stone-300 shadow-lift" : "border-stone-200/80 shadow-soft hover:border-stone-300",
        resolved && !open && "opacity-70",
      )}
    >
      <button className="flex w-full items-start gap-3 px-4 py-3 text-left" onClick={onToggle} aria-expanded={open} aria-controls={`${f.id}-body`}>
        <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", resolved ? "bg-emerald-500" : SEVERITY_DOT[f.severity])} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={cx("block text-sm font-medium text-stone-950", resolved && "text-stone-600")}>{f.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500">
            <span className="sr-only">Severity {f.severity}.</span>
            {f.juror} · <SourceBadge source={f.source} verification={f.verification} />
            {f.location && <Badge tone="outline">{f.location}</Badge>}
            {page && <Badge tone="outline">Page {page}</Badge>}
            {f.ruleIds.map((r) => (
              <span key={r} className="font-mono text-stone-400">{r}</span>
            ))}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {resolved ? <FindingStatusBadge status={f.status} /> : <SeverityBadge s={f.severity} />}
          <ChevronDown size={15} className={cx("text-stone-400 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div id={`${f.id}-body`} className="animate-fade-up space-y-4 border-t border-stone-100 px-4 pb-4 pt-3 text-sm">
          {f.offendingText && (
            <blockquote className={cx("rounded-lg border-l-[3px] border-orange-500 bg-orange-50/70 px-3 py-2 text-[15px] leading-relaxed text-stone-900", !textPresent && !resolved && !f.location && "line-through decoration-stone-400")}>
              “{f.offendingText}”
            </blockquote>
          )}
          <section>
            <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1.5">
              <ScrollText size={12} /> Evidence
            </h4>
            <ul className="space-y-1.5">
              {f.evidence.map((e, i) => (
                <EvidenceRow key={i} e={e} brand={brand} />
              ))}
              {f.evidence.length === 0 && <li className="text-xs text-amber-800">No evidence references — treat as unverified.</li>}
            </ul>
          </section>

          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">Explanation</h4>
            <p className="text-stone-700">{f.explanation}</p>
            {f.whyItMatters && <p className="mt-1 text-stone-600"><span className="font-medium text-stone-800">Why it matters: </span>{f.whyItMatters}</p>}
          </section>

          {f.coordinatorNote && (
            <p className="flex gap-1.5 rounded bg-stone-50 border border-stone-200 px-2.5 py-1.5 text-xs text-stone-700">
              <Info size={13} className="shrink-0 mt-0.5" /> <span><strong>Coordinator:</strong> {f.coordinatorNote}</span>
            </p>
          )}

          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">Suggested fix</h4>
            <p className="text-stone-700">{f.suggestedFix}</p>
            {f.replacement !== undefined && f.offendingText && !editing && (
              <div className="mt-1.5 rounded border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
                <span className="bg-red-100 text-red-800 line-through decoration-red-400">{f.offendingText}</span>
                <CornerDownRight size={13} className="inline mx-1.5 text-stone-400" />
                <span className="bg-emerald-100 text-emerald-900">{f.replacement || "(remove)"}</span>
              </div>
            )}
            {editing && (
              <div className="mt-2 space-y-2">
                <Label htmlFor={`edit-${f.id}`}>Your replacement for “{f.offendingText}”</Label>
                <textarea id={`edit-${f.id}`} className={inputCls} rows={2} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" onClick={() => doAccept(editValue)}>Apply edited fix</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </section>

          {f.confidence !== null && (
            <p className="flex items-center gap-1.5 text-xs text-stone-500">
              <Gauge size={13} /> Model-reported confidence {Math.round(f.confidence * 100)}% — a self-estimate, not a calibrated probability or proof.
            </p>
          )}

          {error && <p className="text-xs text-red-700">{error}</p>}

          {!readOnly && !resolved && (
            <div className="flex flex-wrap gap-2 pt-1" data-tour={tour ? "finding-actions" : undefined}>
              <Button size="sm" variant="primary" disabled={!canAccept} onClick={() => doAccept()}>
                <FileCheck2 size={13} /> Accept Fix
              </Button>
              <Button size="sm" disabled={!canEdit} onClick={() => setEditing(true)}>Edit</Button>
              <Button size="sm" onClick={() => setDismissOpen(true)}>Dismiss</Button>
              <Button size="sm" onClick={() => setEscalateOpen(true)}>
                <ShieldAlert size={13} /> Escalate
              </Button>
              {f.category === "guideline_conflict" && (
                <Link href="/guidelines" className="text-xs self-center text-orange-700 hover:underline">View conflict →</Link>
              )}
            </div>
          )}
          {f.location && !resolved && f.offendingText && (
            <p className="text-xs text-stone-500">This is in the {f.location.toLowerCase().startsWith("captions") ? "video captions" : "media"}, not the copy. Fix it at the source, then re-run the review.</p>
          )}
          {!textPresent && !resolved && f.offendingText && !f.location && (
            <p className="text-xs text-stone-500">The flagged text is no longer in the draft. Re-run the review or dismiss this finding.</p>
          )}

          {!readOnly && (
            <section className="border-t border-stone-100 pt-2">
              <button
                className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500 hover:text-stone-900"
                aria-expanded={discussOpen}
                onClick={() => setDiscussOpen(!discussOpen)}
              >
                <MessageSquare size={12} /> Discussion {thread.length > 0 && <span className="rounded-full bg-orange-600 px-1.5 text-[10px] text-white normal-case">{thread.length}</span>}
              </button>
              {discussOpen && (
                <div className="mt-2">
                  <CommentThread itemId={itemId} comments={comments ?? []} findingId={f.id} placeholder="Ask about this finding… e.g. @reviewer is this claim OK for the EU?" />
                </div>
              )}
            </section>
          )}
          {f.history.length > 1 && (
            <section className="border-t border-stone-100 pt-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">Decision history</h4>
              <ul className="space-y-0.5 text-xs text-stone-600">
                {f.history.map((h, i) => (
                  <li key={i}>
                    <span className="text-stone-400">{fmtDate(h.at)}</span> · <span className="capitalize font-medium text-stone-800">{h.action}</span> by {h.by}
                    {h.reason && <> — <strong>{h.reason}</strong></>}
                    {h.note && <>: “{h.note}”</>}
                    {h.after !== undefined && <> → “{h.after}”</>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!readOnly && resolved && (
            <Button size="sm" variant="ghost" onClick={() => reopenFinding(itemId, f.id)}>Reopen</Button>
          )}
        </div>
      )}
      {!open && resolved && last && (
        <div className="-mt-1 pb-3 pl-9 pr-4 text-xs capitalize text-stone-500">
          {last.action} by {last.by}{last.reason ? ` — ${last.reason}` : ""}
        </div>
      )}

      <Modal
        open={dismissOpen}
        onClose={() => setDismissOpen(false)}
        title={`Dismiss ${f.id}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDismissOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={reason === "Other" && !note.trim()}
              onClick={() => {
                dismissFinding(itemId, f.id, reason, note.trim());
                setDismissOpen(false);
              }}
            >
              Dismiss finding
            </Button>
          </>
        }
      >
        <p className="text-stone-600 mb-3">A reason is required. Dismissals are recorded as review signals — they don’t prove the finding was wrong.</p>
        <fieldset className="space-y-1.5">
          {DISMISS_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 rounded border border-stone-200 px-3 py-2 cursor-pointer has-[:checked]:border-stone-900">
              <input type="radio" name={`reason-${f.id}`} checked={reason === r} onChange={() => setReason(r)} />
              {r}
            </label>
          ))}
        </fieldset>
        <div className="mt-3">
          <Label htmlFor={`note-${f.id}`}>Note {reason === "Other" ? "(required)" : "(optional)"}</Label>
          <textarea id={`note-${f.id}`} className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </Modal>

      <Modal
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        title={`Escalate ${f.id}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEscalateOpen(false)}>Cancel</Button>
            <Button
              variant="accent"
              onClick={() => {
                escalateFinding(itemId, f.id, note.trim());
                setEscalateOpen(false);
              }}
            >
              Escalate
            </Button>
          </>
        }
      >
        <p className="text-stone-600 mb-3">Escalated findings stay unresolved and are highlighted to the approving reviewer.</p>
        <Label htmlFor={`esc-${f.id}`}>Note for the reviewer</Label>
        <textarea id={`esc-${f.id}`} className={inputCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Needs regulatory sign-off" />
      </Modal>
    </article>
  );
}

function EvidenceRow({ e, brand }: { e: EvidenceRef; brand: Brand }) {
  if (e.type === "guideline") {
    const rule = brand.rules.find((r) => r.id === e.id);
    const changed = rule && rule.text !== e.excerpt;
    return (
      <li className={cx("rounded border px-3 py-2", e.verified ? "border-stone-200 bg-stone-50" : "border-amber-300 bg-amber-50")}>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-semibold text-stone-900">Guideline {e.id}</span>
          {rule && <span className="text-stone-500">{rule.title} · v{rule.version}</span>}
          {!e.verified && <Badge tone="amber">Unresolved reference</Badge>}
          {changed && <Badge tone="outline">Rule since revised</Badge>}
        </div>
        <p className="mt-0.5 text-stone-700">“{e.excerpt}”</p>
        {e.note && <p className="text-xs text-stone-500 mt-0.5">{e.note}</p>}
      </li>
    );
  }
  if (e.type === "approved_fact") {
    const fact = brand.facts.find((x) => x.id === e.id);
    const st = fact ? factState(fact) : null;
    return (
      <li className={cx("rounded border px-3 py-2", e.verified ? "border-stone-200 bg-stone-50" : "border-amber-300 bg-amber-50")}>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-stone-900">Approved fact {e.id}</span>
          {st && <Badge tone={st === "active" ? "green" : st === "expired" ? "red" : "amber"}>{st}</Badge>}
          {!e.verified && <Badge tone="amber">Unresolved reference</Badge>}
        </div>
        <p className="mt-0.5 text-stone-700">“{e.excerpt}”</p>
        {fact && (
          <p className="text-[11px] text-stone-500 mt-0.5">
            {fact.source} · verified {fact.lastVerified}
            {fact.expires && ` · expires ${fact.expires}`}
          </p>
        )}
        {e.note && <p className="text-xs text-stone-600 mt-0.5">{e.note}</p>}
      </li>
    );
  }
  if (e.type === "no_fact") {
    return (
      <li className="rounded border border-dashed border-stone-300 px-3 py-2">
        <div className="text-xs font-semibold text-stone-900">No approved supporting fact</div>
        <p className="text-stone-700">{e.excerpt}</p>
        {e.note && <p className="text-xs text-stone-500">{e.note}</p>}
      </li>
    );
  }
  return (
    <li className="rounded border border-stone-200 bg-stone-50 px-3 py-2">
      <div className="text-xs font-semibold text-stone-900">Measurement</div>
      <p className="text-stone-700">{e.excerpt}</p>
    </li>
  );
}
