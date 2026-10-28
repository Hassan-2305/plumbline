"use client";

import { Loader2, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, cx, inputCls } from "@/components/ui";
import { recordAiCall, activeBrand, addConflicts, brandConflicts } from "@/lib/store";
import { detectConflicts } from "@/lib/engine/conflicts";
import { useAiStatus } from "@/lib/useAiStatus";
import { redact } from "@/lib/privacy/redact";
import type { AiConflict, AppState, ConflictAnalysisResponse } from "@/lib/types";

const SAMPLE = "Social captions should be playful and use emoji.\nAll customer communication must remain strictly formal.";

export function ConflictAnalysis({ state }: { state: AppState }) {
  const brand = activeBrand(state);
  const ai = useAiStatus();
  const [text, setText] = useState("");
  const [lexical, setLexical] = useState<ReturnType<typeof detectConflicts> | null>(null);
  const [aiResult, setAiResult] = useState<{ model: string; conflicts: AiConflict[]; dropped: number } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pasted = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((t, i) => ({ id: `P-${i + 1}`, text: t }));
  const all = [...brand.rules.map((r) => ({ id: r.id, text: r.text })), ...pasted];
  const lookup = (id: string) => all.find((r) => r.id === id)?.text;
  const isExisting = (id: string) => brand.rules.some((r) => r.id === id);
  const aiReady = !!ai?.configured && ai.verified !== "no";

  const runAi = async () => {
    setBusy(true);
    setAiError(null);
    setAiResult(null);
    try {
      const sent = all.map((r) => ({ id: r.id, text: redact(r.text, brand.sensitiveTerms).text }));
      const counts = all.flatMap((r) => redact(r.text, brand.sensitiveTerms).counts);
      const log = (outcome: "ok" | "failed", model: string, error?: string) =>
        recordAiCall({
          purpose: "conflict analysis",
          service: "Google Gemini API",
          model,
          sentPreview: sent.map((r) => `${r.id}: ${r.text}`).join("\n"),
          sentChars: sent.reduce((n, r) => n + r.text.length, 0),
          redactions: counts,
          outcome,
          error,
        });
      const res = await fetch("/api/guidelines/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rules: sent }),
      });
      const data = (await res.json().catch(() => null)) as ConflictAnalysisResponse | null;
      if (data?.ok) {
        log("ok", data.model);
        setAiResult(data);
      } else {
        const msg = data && !data.ok ? data.error.message : `Request failed (HTTP ${res.status}).`;
        log("failed", ai?.model ?? "unknown", msg);
        setAiError(msg);
      }
    } catch {
      recordAiCall({ purpose: "conflict analysis", service: "Google Gemini API", model: ai?.model ?? "unknown", sentPreview: "", sentChars: 0, redactions: [], outcome: "failed", error: "Network error" });
      setAiError("Could not reach the analysis service.");
    } finally {
      setBusy(false);
    }
  };

  const tracked = (c: AiConflict) => brandConflicts(state).some((x) => x.ruleIds[0] === c.ruleIds[0] && x.ruleIds[1] === c.ruleIds[1]);

  return (
    <Card className="mt-6 p-5">
      <h3 className="text-sm font-semibold text-stone-900">Check guidelines for conflicts</h3>
      <p className="text-xs text-stone-600 mt-0.5">
        Paste new rules (one per line) to test them against the current {brand.name} rules, or leave the box empty to scan the current rules only. Pasted text is not saved.
      </p>
      <textarea
        className={cx(inputCls, "mt-3")}
        rows={4}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setLexical(null);
          setAiResult(null);
        }}
        placeholder={SAMPLE}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={() => setLexical(detectConflicts(all))}>
          Deterministic check
        </Button>
        <Button size="sm" disabled={!aiReady || busy} onClick={runAi} title={aiReady ? undefined : "Live AI is not configured"}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Analyse with AI
        </Button>
        {!text && (
          <Button size="sm" variant="ghost" onClick={() => setText(SAMPLE)}>
            Use sample text
          </Button>
        )}
      </div>
      {!aiReady && ai && (
        <p className="mt-1.5 text-[11px] text-stone-500">AI analysis needs GEMINI_API_KEY on the server. The deterministic check works without it.</p>
      )}
      {aiReady && <p className="mt-1.5 text-[11px] text-stone-500">AI analysis sends the rule text to Google’s Gemini API.</p>}

      {lexical && (
        <div className="mt-4 space-y-2">
          <div className="text-[11px] font-medium text-stone-500">Deterministic (opposing terms)</div>
          {lexical.length === 0 && <p className="text-sm text-stone-600">No opposing terms found. This check is lexical only and is not a full semantic review.</p>}
          {lexical.map((r, i) => (
            <div key={i} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="font-medium text-amber-950">
                {r.ruleIds[0]} ↔ {r.ruleIds[1]} · {r.dimension}
              </div>
              <p className="text-xs text-stone-700 mt-1">{r.ruleIds[0]}: “{lookup(r.ruleIds[0])}”</p>
              <p className="text-xs text-stone-700">{r.ruleIds[1]}: “{lookup(r.ruleIds[1])}”</p>
              <p className="text-xs text-stone-600 mt-1">
                “{r.termA}” vs “{r.termB}”.{" "}
                {brandConflicts(state).some((c) => c.ruleIds.join() === r.ruleIds.join()) ? "Already tracked in Guideline Intelligence above." : "Decide which applies where before publishing these rules."}
              </p>
            </div>
          ))}
        </div>
      )}

      {aiError && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">AI analysis failed: {aiError} No AI results were recorded.</p>}
      {aiResult && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-medium text-stone-500">
            AI-assisted ({aiResult.model}) <Badge tone="outline">Proposals only</Badge>
          </div>
          {aiResult.dropped > 0 && <p className="text-[11px] text-stone-500">{aiResult.dropped} result(s) discarded for citing rule IDs that don’t exist or being incomplete.</p>}
          {aiResult.conflicts.length === 0 && <p className="text-sm text-stone-600">The model reported no conflicts.</p>}
          {aiResult.conflicts.map((c, i) => {
            const both = isExisting(c.ruleIds[0]) && isExisting(c.ruleIds[1]);
            return (
              <div key={i} className="rounded border border-stone-200 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 font-medium text-stone-900">
                  {c.ruleIds[0]} ↔ {c.ruleIds[1]}
                  {c.confidence !== null && <span className="text-[11px] font-normal text-stone-500">model-reported confidence {Math.round(c.confidence * 100)}%</span>}
                </div>
                <p className="text-xs text-stone-700 mt-1">{c.ruleIds[0]}: “{lookup(c.ruleIds[0])}”</p>
                <p className="text-xs text-stone-700">{c.ruleIds[1]}: “{lookup(c.ruleIds[1])}”</p>
                <p className="text-xs text-stone-700 mt-1.5"><strong>Why:</strong> {c.why}</p>
                {c.exampleContext && <p className="text-xs text-stone-700"><strong>Example:</strong> {c.exampleContext}</p>}
                <p className="text-xs text-stone-700"><strong>Proposed {c.targetRuleId} wording:</strong> “{c.proposedText}”</p>
                {both ? (
                  tracked(c) ? (
                    <p className="mt-2 text-[11px] text-stone-500">Already tracked in Guideline Intelligence.</p>
                  ) : (
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() =>
                        addConflicts([
                          {
                            id: `C-AI-${brand.id}-${c.ruleIds.join("-")}`,
                            ruleIds: c.ruleIds,
                            why: c.why,
                            exampleContext: c.exampleContext,
                            proposedRuleId: c.targetRuleId,
                            proposedText: c.proposedText,
                            status: "open",
                            detectedBy: `AI-assisted analysis (${aiResult.model}) — proposal`,
                          },
                        ])
                      }
                    >
                      <Plus size={13} /> Track in Guideline Intelligence
                    </Button>
                  )
                ) : (
                  <p className="mt-2 text-[11px] text-stone-500">Involves pasted text. Resolve it before proposing these rules.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
