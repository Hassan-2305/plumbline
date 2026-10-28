"use client";

import { FileUp, History, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, Label, SectionTitle, fmtDate, inputCls } from "@/components/ui";
import { activeBrand, proposeChange } from "@/lib/store";
import type { AppState, Rule, RuleRole } from "@/lib/types";
import { RULE_ROLES } from "@/lib/types";
import { ImportPanel } from "./ImportPanel";

function RuleForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  withRole,
}: {
  initial: { title: string; text: string };
  submitLabel: string;
  onSubmit: (v: { title: string; text: string; reason: string; role?: RuleRole | "" }) => void;
  onCancel: () => void;
  withRole?: boolean;
}) {
  const [role, setRole] = useState<RuleRole | "">("");
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(initial.text);
  const [reason, setReason] = useState("");
  const changed = text.trim() && (text.trim() !== initial.text || title.trim() !== initial.title);
  return (
    <div className="mt-3 space-y-2 rounded border border-stone-200 bg-stone-50 p-3">
      <div>
        <Label>Title</Label>
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <Label>Rule text</Label>
        <textarea className={inputCls} rows={2} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {withRole && (
        <div>
          <Label>Check category (optional)</Label>
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as RuleRole | "")}>
            <option value="">None — guidance only</option>
            {RULE_ROLES.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
          </select>
        </div>
      )}
      <div>
        <Label>Reason for the change (required)</Label>
        <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Writers keep asking whether this covers emails" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" disabled={!changed || !reason.trim()} onClick={() => onSubmit({ title: title.trim(), text: text.trim(), reason: reason.trim(), role })}>
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      <p className="text-[11px] text-stone-500">This creates a proposal. The rule stays unchanged until a reviewer approves it.</p>
    </div>
  );
}

function RuleRow({ r, pending, role }: { r: Rule; pending: boolean; role?: string }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="font-mono text-xs font-semibold text-stone-900 w-12 shrink-0 pt-0.5">{r.id}</span>
        <div className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-stone-900">{r.title}</span>
          <span className="block text-sm text-stone-700">{r.text}</span>
          {r.history.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] text-stone-500">{r.history.length} previous version{r.history.length > 1 ? "s" : ""}</summary>
              <ul className="mt-1 space-y-1 border-l-2 border-stone-200 pl-3">
                {[...r.history].reverse().map((h) => (
                  <li key={h.version} className="text-xs text-stone-600">
                    <span className="flex items-center gap-1 font-medium text-stone-800"><History size={12} /> v{h.version} · replaced {fmtDate(h.changedAt)}</span>
                    <span className="line-through decoration-stone-400">{h.text}</span>
                    <span className="block text-stone-500">{h.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {role && <Badge tone="outline" className="hidden sm:inline-flex">Cited by {role.toLowerCase()} checks</Badge>}
          {pending && <Badge tone="amber">Edit pending</Badge>}
          <Badge tone={r.version > 1 ? "orange" : "outline"}>v{r.version}</Badge>
          {!editing && !pending && (
            <button aria-label={`Propose edit to ${r.id}`} className="text-stone-400 hover:text-stone-900" onClick={() => setEditing(true)}>
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="ml-15">
          <RuleForm
            initial={{ title: r.title, text: r.text }}
            submitLabel="Propose edit"
            onCancel={() => setEditing(false)}
            onSubmit={(v) => {
              proposeChange({ kind: "rule_edit", ruleId: r.id, title: v.title, text: v.text, reason: v.reason });
              setEditing(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function RulesSection({ state }: { state: AppState }) {
  const brand = activeBrand(state);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const pendingIds = new Set(brand.changes.filter((c) => c.status === "pending" && c.kind === "rule_edit").map((c) => c.ruleId));
  const pendingNew = brand.changes.filter((c) => c.status === "pending" && c.kind === "rule_add").length;
  const roleOf = (id: string) => RULE_ROLES.find((r) => brand.ruleRoles?.[r.role] === id)?.label;
  return (
    <section id="rules" className="space-y-4">
      <SectionTitle
        aside={
          <div className="flex gap-2">
            {!importing && (
              <Button size="sm" onClick={() => setImporting(true)}>
                <FileUp size={13} /> Import brand book
              </Button>
            )}
            {!adding && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus size={13} /> Propose rule
              </Button>
            )}
          </div>
        }
      >
        Brand rules ({brand.rules.length})
      </SectionTitle>
      {importing && <ImportPanel onClose={() => setImporting(false)} />}
      {adding && (
        <RuleForm
          initial={{ title: "", text: "" }}
          submitLabel="Propose new rule"
          withRole
          onCancel={() => setAdding(false)}
          onSubmit={(v) => {
            proposeChange({ kind: "rule_add", title: v.title || "New rule", text: v.text, reason: v.reason, role: v.role || undefined });
            setAdding(false);
          }}
        />
      )}
      {pendingNew > 0 && <p className="text-xs text-amber-800">{pendingNew} new rule proposal(s) are waiting for a reviewer under Conflicts &amp; proposals.</p>}
      {brand.rules.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-serif text-2xl text-stone-950">No rules yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-600">
            Import your brand book or propose rules one at a time. The built-in checks still run, but findings won’t cite a brand rule until one exists.
          </p>
          {!importing && (
            <Button variant="accent" className="mt-4" onClick={() => setImporting(true)}>
              <FileUp size={14} /> Import brand book
            </Button>
          )}
        </Card>
      ) : (
        <Card className="divide-y divide-stone-100">
          {brand.rules.map((r) => (
            <RuleRow key={r.id} r={r} pending={pendingIds.has(r.id)} role={roleOf(r.id)} />
          ))}
        </Card>
      )}
    </section>
  );
}
