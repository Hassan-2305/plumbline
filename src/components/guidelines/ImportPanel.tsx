"use client";

import { FileUp, Loader2, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { Badge, Button, Card, IconChip, cx, inputCls } from "@/components/ui";
import { activeBrand, proposeChange, recordAiCall, useAppState } from "@/lib/store";
import { redact, restore } from "@/lib/privacy/redact";
import { extractDocument, findCandidates, findColours, ruleTitle, type Candidate, type ExtractedDoc } from "@/lib/import/extract";
import { useAiStatus } from "@/lib/useAiStatus";
import { RULE_ROLES, type RuleRole } from "@/lib/types";

const SAMPLE = { url: "/demo/aurora-brand-book.pdf", name: "aurora-brand-book.pdf" };

export function ImportPanel({ onClose }: { onClose: () => void }) {
  const state = useAppState()!;
  const brand = activeBrand(state);
  const ai = useAiStatus();
  const input = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<ExtractedDoc | null>(null);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [roles, setRoles] = useState<Record<string, RuleRole | "">>({});
  const [busy, setBusy] = useState<"read" | "ai" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const defaultRule = brand.ruleRoles?.sensational ?? brand.rules[0]?.id ?? "";
  const [governing, setGoverning] = useState(defaultRule);

  const load = async (file: File) => {
    setBusy("read");
    setError(null);
    setDone(null);
    setAiNote(null);
    try {
      const d = await extractDocument(file);
      const c = findCandidates(d);
      setDoc(d);
      setCands(c);
      setPicked(Object.fromEntries(c.map((x) => [x.id, x.kind === "rule" || !!defaultRule])));
      setRoles(Object.fromEntries(c.map((x) => [x.id, x.role ?? ""])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file.");
    } finally {
      setBusy(null);
    }
  };

  const loadSample = async () => {
    const res = await fetch(SAMPLE.url);
    if (!res.ok) return setError("Could not load the sample brand book.");
    await load(new File([await res.blob()], SAMPLE.name, { type: "application/pdf" }));
  };

  const runAi = async () => {
    if (!doc) return;
    setBusy("ai");
    setAiNote(null);
    try {
      const red = redact(doc.pages.map((p) => p.text).join("\n\n").slice(0, 30000), brand.sensitiveTerms);
      const text = red.text;
      const res = await fetch("/api/guidelines/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await res.json().catch(() => null);
      recordAiCall({
        purpose: "rule extraction",
        service: "Google Gemini API",
        model: data?.model ?? ai?.model ?? "unknown",
        itemTitle: doc.fileName,
        sentPreview: text,
        sentChars: text.length,
        redactions: red.counts,
        outcome: data?.ok ? "ok" : "failed",
        error: data?.ok ? undefined : data?.error?.message ?? `HTTP ${res.status}`,
      });
      if (!data?.ok) {
        setAiNote(`AI extraction failed: ${data?.error?.message ?? `HTTP ${res.status}`} The pattern-based results below are unaffected.`);
        return;
      }
      const page = (quote: string) => doc.pages.find((p) => p.text.toLowerCase().includes(quote.slice(0, 40).toLowerCase()))?.page ?? 1;
      const extra: Candidate[] = data.rules.map((r: { title: string; rule: string; quote: string; role?: RuleRole }, i: number) => ({
        id: `ai${i}`,
        kind: "rule",
        text: restore(r.rule, red.redactions)!,
        title: restore(r.title, red.redactions),
        page: page(r.quote),
        role: r.role,
        source: "ai",
      }));
      setCands((c) => [...c.filter((x) => x.source !== "ai"), ...extra]);
      setPicked((p) => ({ ...p, ...Object.fromEntries(extra.map((x) => [x.id, false])) }));
      setRoles((r) => ({ ...r, ...Object.fromEntries(extra.map((x) => [x.id, x.role ?? ""])) }));
      setAiNote(`${extra.length} rule(s) suggested by ${data.model}${data.dropped ? `; ${data.dropped} discarded because their quote wasn’t found in the document` : ""}. Review before proposing.`);
    } catch {
      setAiNote("Could not reach the AI service. The pattern-based results below are unaffected.");
    } finally {
      setBusy(null);
    }
  };

  const chosen = cands.filter((c) => picked[c.id]);
  const propose = () => {
    for (const c of chosen) {
      const source = `Imported from ${doc!.fileName}, page ${c.page}`;
      const role = roles[c.id] || undefined;
      if (c.kind === "rule") proposeChange({ kind: "rule_add", title: c.title || ruleTitle(c.text), text: c.text, role, source, reason: source });
      else {
        // Prefer the approved rule imported from the same sentence; fall back to the chosen governing rule.
        const ruleId = brand.rules.find((r) => r.text.trim() === c.text.trim())?.id ?? governing;
        if (!ruleId) continue;
        if (c.kind === "banned") proposeChange({ kind: "banned_add", term: c.term, ruleId, source, reason: source });
        else proposeChange({ kind: "preferred_add", term: c.term, avoid: c.avoid, ruleId, source, reason: source });
      }
    }
    setDone(chosen.length);
    setDoc(null);
    setCands([]);
  };

  const colours = doc ? findColours(doc) : [];
  const aiReady = !!ai?.configured && ai.verified !== "no";

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <IconChip tone="orange"><FileUp size={16} /></IconChip>
        <div className="flex-1">
          <h3 className="font-serif text-xl text-stone-950">Import a brand book</h3>
          <p className="text-sm text-stone-600">
            PDF, .txt or .md. Text is read in your browser. Detected rules become <strong>proposals</strong> that a reviewer approves. Nothing is added automatically.
          </p>
        </div>
        <button aria-label="Close import" onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-900"><X size={16} /></button>
      </div>

      {done !== null && (
        <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {done} proposal{done === 1 ? "" : "s"} added. A reviewer can approve them under Conflicts &amp; proposals.
        </p>
      )}

      {!doc && (
        <div
          className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) load(f);
          }}
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" disabled={!!busy} onClick={() => input.current?.click()}>
              {busy === "read" ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />} Choose file
            </Button>
            <Button disabled={!!busy} onClick={loadSample}>Use sample brand book</Button>
          </div>
          <p className="mt-2 text-xs text-stone-500">or drop a file here · max 15 MB · scanned image-only PDFs aren’t supported</p>
          <input
            ref={input}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) load(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {doc && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="outline">{doc.fileName}</Badge>
            <span className="text-stone-500">{doc.pages.length} page(s) · {doc.chars.toLocaleString()} characters · {cands.filter((c) => c.source === "pattern").length} candidates found by pattern</span>
            <Button size="sm" className="ml-auto" disabled={!aiReady || !!busy} onClick={runAi} title={aiReady ? undefined : "Live AI is not configured"}>
              {busy === "ai" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Suggest more with AI
            </Button>
          </div>
          {aiReady && <p className="-mt-2 text-[11px] text-stone-500">AI suggestions send the document text to Google’s Gemini API. Each suggestion must quote the document verbatim.</p>}
          {aiNote && <p className="text-xs text-stone-600">{aiNote}</p>}
          {colours.length > 0 && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
              Colours mentioned:
              {colours.map((c) => (
                <span key={c.hex} className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-0.5">
                  <span className="h-3 w-3 rounded-full border border-stone-200" style={{ background: c.hex }} /> {c.name} {c.hex}
                </span>
              ))}
              <span className="text-stone-400">(not applied — edit the palette when creating a brand)</span>
            </p>
          )}

          <ul className="max-h-[420px] divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200">
            {cands.length === 0 && <li className="p-4 text-sm text-stone-600">No rule-like sentences found. Try “Suggest more with AI”, or add rules by hand.</li>}
            {cands.map((c) => (
              <li key={c.id} className={cx("flex gap-3 px-3 py-2.5", !picked[c.id] && "opacity-60")}>
                <input
                  type="checkbox"
                  aria-label={`Include: ${c.text}`}
                  className="mt-1"
                  checked={!!picked[c.id]}
                  disabled={c.kind !== "rule" && !governing}
                  onChange={(e) => setPicked({ ...picked, [c.id]: e.target.checked })}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={c.kind === "banned" ? "red" : c.kind === "preferred" ? "green" : "outline"}>
                      {c.kind === "banned" ? `Ban “${c.term}”` : c.kind === "preferred" ? `Prefer “${c.term}”` : "Rule"}
                    </Badge>
                    {c.source === "ai" && <Badge tone="outline">AI-assisted</Badge>}
                    <span className="text-[11px] text-stone-400">p.{c.page}</span>
                  </div>
                  <p className="mt-1 text-sm text-stone-800">{c.title && c.source === "ai" ? <strong>{c.title}: </strong> : null}{c.text}</p>
                </div>
                {c.kind === "rule" && (
                  <select
                    aria-label="Check category"
                    className="h-8 shrink-0 self-center rounded-md border border-stone-200 bg-white px-1.5 text-xs text-stone-600"
                    value={roles[c.id] ?? ""}
                    onChange={(e) => setRoles({ ...roles, [c.id]: e.target.value as RuleRole | "" })}
                  >
                    <option value="">No check category</option>
                    {RULE_ROLES.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
                  </select>
                )}
              </li>
            ))}
          </ul>

          {cands.some((c) => c.kind !== "rule") && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
              Terminology proposals are governed by
              {brand.rules.length ? (
                <select className={cx(inputCls, "h-8 w-auto py-0 text-xs")} value={governing} onChange={(e) => setGoverning(e.target.value)}>
                  {brand.rules.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.title}</option>)}
                </select>
              ) : (
                <span className="text-amber-800">— no approved rules yet. Approve imported rules first, then import terms.</span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="accent" disabled={!chosen.length} onClick={propose}>
              Propose {chosen.length} item{chosen.length === 1 ? "" : "s"}
            </Button>
            <Button variant="ghost" onClick={() => { setDoc(null); setCands([]); }}>Choose another file</Button>
            <span className="text-xs text-stone-500">“Check category” connects a rule to a built-in check so findings cite it.</span>
          </div>
        </div>
      )}
    </Card>
  );
}
