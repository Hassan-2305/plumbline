"use client";

import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Badge, Button, Card, Label, SectionTitle, inputCls } from "@/components/ui";
import { activeBrand, proposeChange, setReferenceLogo } from "@/lib/store";
import { ACCEPTED_TYPES, analyzeImage, analyzeUrl } from "@/lib/image/analyze";
import type { AppState, ImageAnalysis } from "@/lib/types";
import { ImageFacts } from "../review/ImagePanel";
import { RoleNote } from "./RoleNote";

function TermForm({ ruleIds, onDone }: { ruleIds: string[]; onDone: () => void }) {
  const [kind, setKind] = useState<"banned_add" | "preferred_add">("banned_add");
  const [term, setTerm] = useState("");
  const [other, setOther] = useState("");
  const [ruleId, setRuleId] = useState(ruleIds.includes("R-004") ? "R-004" : ruleIds[0]);
  const [reason, setReason] = useState("");
  const avoid = other.split(",").map((s) => s.trim()).filter(Boolean);
  const valid = term.trim() && reason.trim() && (kind === "banned_add" || avoid.length > 0);
  return (
    <div className="space-y-2 rounded border border-stone-200 bg-stone-50 p-3">
      <div className="flex gap-3 text-sm">
        {(["banned_add", "preferred_add"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1.5">
            <input type="radio" checked={kind === k} onChange={() => setKind(k)} /> {k === "banned_add" ? "Ban a term" : "Prefer a term"}
          </label>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label>{kind === "banned_add" ? "Banned term" : "Preferred term"}</Label>
          <input className={inputCls} value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
        <div>
          <Label>{kind === "banned_add" ? "Suggested replacement (optional)" : "Instead of (comma-separated)"}</Label>
          <input className={inputCls} value={other} onChange={(e) => setOther(e.target.value)} />
        </div>
        <div>
          <Label>Governing rule</Label>
          <select className={inputCls} value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
            {ruleIds.map((id) => <option key={id}>{id}</option>)}
          </select>
        </div>
        <div>
          <Label>Reason (required)</Label>
          <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="primary"
          disabled={!valid}
          onClick={() => {
            proposeChange(
              kind === "banned_add"
                ? { kind, term: term.trim(), replacement: other.trim() || undefined, ruleId, reason: reason.trim() }
                : { kind, term: term.trim(), avoid, ruleId, reason: reason.trim() },
            );
            onDone();
          }}
        >
          Propose
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

function LogoCard({ state }: { state: AppState }) {
  const brand = activeBrand(state);
  const reviewer = state.role === "reviewer";
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (p: Promise<ImageAnalysis>) => {
    setBusy(true);
    setError(null);
    try {
      setReferenceLogo(await p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyse the logo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-4 space-y-3">
      {brand.logo ? (
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
          <img src={brand.logo.thumb} alt={`${brand.name} reference logo (fictional)`} className="h-16 w-32 shrink-0 rounded border border-stone-200 object-contain" />
          <div className="min-w-0 flex-1">
            <ImageFacts img={brand.logo} brand={brand} />
          </div>
          {reviewer && (
            <button aria-label="Remove reference logo" className="self-start text-stone-400 hover:text-red-600" onClick={() => setReferenceLogo(undefined)}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-stone-600">No reference logo yet. Add one so logo files in content can be compared with it.</p>
      )}
      {reviewer ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} {brand.logo ? "Replace logo" : "Upload logo"}
          </Button>
          {!brand.logo && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(analyzeUrl("/demo/northstar-logo.svg", "northstar-logo.svg"))}>
              Use demo logo
            </Button>
          )}
          <input
            ref={input}
            type="file"
            className="hidden"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) run(analyzeImage(f));
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <RoleNote role={state.role} action="change the reference logo" />
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
      <p className="text-[11px] text-stone-500">
        Comparison uses a perceptual hash and aspect ratio of whole files. It can spot a different or stretched logo file, but it cannot find a logo inside a larger image.
      </p>
    </Card>
  );
}

export function TermsSection({ state }: { state: AppState }) {
  const brand = activeBrand(state);
  const [adding, setAdding] = useState(false);
  const pending = brand.changes.filter((c) => c.status === "pending" && (c.kind === "banned_add" || c.kind === "preferred_add"));
  return (
    <section id="assets" className="grid gap-6 lg:grid-cols-2">
      <div>
        <SectionTitle
          aside={
            !adding && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus size={13} /> Propose term
              </Button>
            )
          }
        >
          Terminology
        </SectionTitle>
        {adding && (
          <div className="mb-3">
            <TermForm ruleIds={brand.rules.map((r) => r.id)} onDone={() => setAdding(false)} />
          </div>
        )}
        <Card className="p-4 space-y-3 text-sm">
          {brand.bannedTerms.map((b) => (
            <div key={b.term} className="flex flex-wrap items-center gap-2">
              <Badge tone="red">Banned</Badge> “{b.term}” <span className="text-xs text-stone-500">({b.ruleId}{b.replacement ? `, suggest “${b.replacement}”` : ""})</span>
            </div>
          ))}
          {brand.preferredTerms.map((p) => (
            <div key={p.prefer}>
              <div className="flex items-center gap-2"><Badge tone="green">Preferred</Badge> “{p.prefer}” <span className="text-xs text-stone-500">({p.ruleId})</span></div>
              <div className="mt-1 text-xs text-stone-600">Instead of: {p.avoid.map((a) => `“${a}”`).join(", ")}</div>
            </div>
          ))}
          {pending.length > 0 && <p className="text-xs text-amber-800">{pending.length} terminology proposal(s) awaiting review.</p>}
        </Card>
        <SectionTitle>
          <span className="mt-6 block">Approved palette (R-010)</span>
        </SectionTitle>
        <Card className="p-4 grid grid-cols-5 gap-2">
          {brand.palette.map((p) => (
            <div key={p.hex} className="text-center">
              <div className="h-12 rounded border border-stone-200" style={{ background: p.hex }} />
              <div className="mt-1 text-[11px] font-medium text-stone-800">{p.name}</div>
              <div className="text-[10px] font-mono text-stone-500">{p.hex}</div>
            </div>
          ))}
        </Card>
      </div>
      <div>
        <SectionTitle>Reference logo (R-010)</SectionTitle>
        <LogoCard state={state} />
      </div>
    </section>
  );
}
