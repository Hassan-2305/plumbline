"use client";

import { Check, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, Label, SectionTitle, inputCls } from "@/components/ui";
import { activeBrand, addFact, approveFact, reverifyFact } from "@/lib/store";
import { factState } from "@/lib/engine/evidence";
import type { ApprovedFact, AppState } from "@/lib/types";
import { RoleNote } from "./RoleNote";

function plusOneYear() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function FactActions({ f, reviewer }: { f: ApprovedFact; reviewer: boolean }) {
  const [renewing, setRenewing] = useState(false);
  const [expires, setExpires] = useState(plusOneYear());
  if (!reviewer) return null;
  if (f.status === "pending")
    return (
      <Button size="sm" onClick={() => approveFact(f.id)}>
        <Check size={12} /> Approve
      </Button>
    );
  if (!renewing)
    return (
      <Button size="sm" variant="ghost" onClick={() => setRenewing(true)}>
        <RefreshCw size={12} /> Re-verify
      </Button>
    );
  return (
    <div className="flex items-center gap-1">
      <input type="date" aria-label="New expiry date" className="rounded border border-stone-300 px-1 py-0.5 text-xs" value={expires} onChange={(e) => setExpires(e.target.value)} />
      <Button
        size="sm"
        variant="primary"
        onClick={() => {
          reverifyFact(f.id, expires);
          setRenewing(false);
        }}
      >
        Save
      </Button>
    </div>
  );
}

export function FactsSection({ state }: { state: AppState }) {
  const brand = activeBrand(state);
  const reviewer = state.role === "reviewer";
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ statement: "", source: "", expires: "", keyPhrase: "" });

  return (
    <section id="facts">
      <SectionTitle
        aside={
          !adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus size={13} /> Propose fact
            </Button>
          )
        }
      >
        Approved fact library ({brand.facts.length})
      </SectionTitle>
      {adding && (
        <div className="mb-3 grid gap-2 rounded border border-stone-200 bg-stone-50 p-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Exact approved statement</Label>
            <textarea className={inputCls} rows={2} value={form.statement} onChange={(e) => setForm({ ...form, statement: e.target.value })} />
          </div>
          <div>
            <Label>Source / substantiation</Label>
            <input className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. Lab report LR-22 (internal)" />
          </div>
          <div>
            <Label>Expiry date (optional)</Label>
            <input type="date" className={inputCls} value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Key phrase that shows content relies on this fact (optional — numbers are detected automatically)</Label>
            <input className={inputCls} value={form.keyPhrase} onChange={(e) => setForm({ ...form, keyPhrase: e.target.value })} />
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button
              size="sm"
              variant="primary"
              disabled={!form.statement.trim() || !form.source.trim()}
              onClick={() => {
                addFact(form);
                setForm({ statement: "", source: "", expires: "", keyPhrase: "" });
                setAdding(false);
              }}
            >
              Add as pending
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
          <p className="text-[11px] text-stone-500 md:col-span-2">New facts are pending and cannot support claims until a reviewer approves them.</p>
        </div>
      )}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-stone-50 text-left text-[11px]r text-stone-500">
            <tr>
              <th className="px-4 py-2 font-semibold">ID</th>
              <th className="px-4 py-2 font-semibold">Approved statement</th>
              <th className="px-4 py-2 font-semibold">Source</th>
              <th className="px-4 py-2 font-semibold">Verified</th>
              <th className="px-4 py-2 font-semibold">Expires</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {brand.facts.map((f) => {
              const st = factState(f);
              return (
                <tr key={f.id} className="align-top">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{f.id}</td>
                  <td className="px-4 py-2.5 text-stone-800">{f.statement}</td>
                  <td className="px-4 py-2.5 text-xs text-stone-600">{f.source}</td>
                  <td className="px-4 py-2.5 text-xs text-stone-600 whitespace-nowrap">{f.lastVerified}</td>
                  <td className="px-4 py-2.5 text-xs text-stone-600 whitespace-nowrap">{f.expires ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={st === "active" ? "green" : st === "expired" ? "red" : "amber"}>{st === "pending" ? "pending approval" : st}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <FactActions f={f} reviewer={reviewer} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-stone-500">Fictional statements for demonstration. No real-world substantiation, clinical evidence or regulatory approval is implied.</p>
        <RoleNote role={state.role} action="approve or re-verify facts" />
      </div>
    </section>
  );
}
