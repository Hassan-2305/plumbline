"use client";

import { Download, EyeOff, Plus, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, SectionTitle, cx, fmtDate, inputCls } from "@/components/ui";
import { activeBrand, setSensitiveTerms, useAppState } from "@/lib/store";

export function PrivacySection() {
  const state = useAppState()!;
  const brand = activeBrand(state);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const terms = brand.sensitiveTerms ?? [];
  const ledger = (state.aiLedger ?? []).filter((e) => e.brandId === brand.id);
  const confidentialItems = state.items.filter((i) => i.brandId === brand.id && i.confidential).length;

  const exportLedger = () => {
    const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ai-ledger-${brand.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="space-y-4">
      <SectionTitle>Privacy &amp; AI disclosure · {brand.name}</SectionTitle>
      <Card className="p-5 space-y-4 text-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="mt-0.5 text-emerald-600" />
          <div className="text-stone-600">
            <p>
              <strong className="text-stone-900">What stays in the browser:</strong> images, video frames, captions, imported documents, every confidential item ({confidentialItems}{" "}
              for this brand), and all rule-based checks.
            </p>
            <p className="mt-1">
              <strong className="text-stone-900">What can leave it:</strong> when live AI is turned on, the draft text and alt text, with emails, phone numbers, card-like numbers,
              secrets and the confidential terms below masked, plus the brand’s rules and facts. Each request is logged below.
            </p>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-stone-700">
            <EyeOff size={13} /> Confidential terms (never sent to AI)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {terms.length === 0 && <span className="text-xs text-stone-500">None yet. Add codenames, unreleased products or client names.</span>}
            {terms.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-800">
                {t}
                <button aria-label={`Remove ${t}`} className="text-stone-400 hover:text-red-600" onClick={() => setSensitiveTerms(terms.filter((x) => x !== t))}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (term.trim()) setSensitiveTerms([...terms, term]);
              setTerm("");
            }}
          >
            <label htmlFor="sensitive-term" className="sr-only">Add a confidential term</label>
            <input id="sensitive-term" className={inputCls} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. Project Polaris" />
            <Button type="submit" disabled={!term.trim()}>
              <Plus size={13} /> Add
            </Button>
          </form>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3">
          <span className="text-sm font-medium text-stone-900">AI disclosure ledger</span>
          <Badge tone="outline">{ledger.length} request{ledger.length === 1 ? "" : "s"}</Badge>
          {ledger.length > 0 && (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={exportLedger}>
              <Download size={13} /> Export
            </Button>
          )}
        </div>
        {ledger.length === 0 ? (
          <p className="px-4 py-5 text-sm text-stone-600">No data has been sent to an external AI service for this brand.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {ledger.map((e) => (
              <li key={e.id} className="px-4 py-3 text-xs">
                <button className="flex w-full flex-wrap items-center gap-2 text-left" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>
                  <span className={cx("h-2 w-2 rounded-full", e.outcome === "ok" ? "bg-emerald-500" : "bg-red-500")} aria-hidden />
                  <span className="font-medium capitalize text-stone-900">{e.purpose}</span>
                  {e.itemTitle && <span className="truncate text-stone-600">· {e.itemTitle}</span>}
                  <span className="text-stone-500">
                    · {e.service} · {e.model} · {e.sentChars.toLocaleString()} chars
                  </span>
                  {e.redactions.length > 0 && <Badge tone="green">{e.redactions.reduce((n, r) => n + r.count, 0)} redacted</Badge>}
                  {e.outcome === "failed" && <Badge tone="red">Failed</Badge>}
                  <span className="ml-auto text-stone-400">
                    {fmtDate(e.at)} · {e.by}
                  </span>
                </button>
                {open === e.id && (
                  <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 p-2">
                    <p className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-stone-700">{e.sentPreview || "(nothing sent)"}</p>
                    <p className="mt-1 text-[10px] text-stone-500">
                      {e.redactions.length ? e.redactions.map((r) => `${r.count} ${r.kind}`).join(" · ") : "No redactions."}
                      {e.error && ` · Error: ${e.error}`}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-stone-100 px-4 py-2 text-[11px] text-stone-500">Stored in this browser only. Previews are truncated to 1,500 characters.</p>
      </Card>
    </section>
  );
}
