"use client";

import { FileText, Loader2, Lock, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { Disclosure, Label, cx, inputCls } from "@/components/ui";
import { ImagePanel } from "./ImagePanel";
import { VideoPanel } from "./VideoPanel";
import { setActiveBrand, useAppState } from "@/lib/store";
import { contrastRatio, normalizeHex } from "@/lib/engine/contrast";
import { extractDocument } from "@/lib/import/extract";
import { joinPages } from "@/lib/import/pages";
import { redact } from "@/lib/privacy/redact";
import { EXAMPLES } from "@/lib/seed/examples";
import type { useAiStatus } from "@/lib/useAiStatus";
import type { Brand, ContentMeta, ContentType } from "@/lib/types";
import { CONTENT_TYPES } from "@/lib/types";

export const MAX_CHARS = 60000;

type Form = { title: string; contentType: ContentType; text: string; meta: ContentMeta };

function DocumentImport({ onLoad, hasTitle }: { onLoad: (p: Partial<Form>) => void; hasTitle: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const doc = await extractDocument(file);
      const { text, ranges } = joinPages(doc.pages);
      onLoad({
        text,
        contentType: "Document",
        ...(hasTitle ? {} : { title: file.name.replace(/\.[^.]+$/, "") }),
        meta: { document: { fileName: doc.fileName, kind: doc.kind, bytes: doc.bytes, pages: ranges } } as ContentMeta,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the document.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="flex items-center gap-2">
      <button onClick={() => input.current?.click()} disabled={busy} className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900">
        {busy ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} Import document
      </button>
      <button
        onClick={async () => {
          const res = await fetch("/demo/northstar-sell-sheet.pdf");
          if (res.ok) load(new File([await res.blob()], "northstar-sell-sheet.pdf", { type: "application/pdf" }));
        }}
        disabled={busy}
        className="text-xs text-accent-700 hover:underline"
      >
        Sample PDF
      </button>
      {error && <span className="max-w-[14rem] truncate text-[11px] text-red-700" title={error}>{error}</span>}
      <input
        ref={input}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) load(f);
          e.target.value = "";
        }}
      />
    </span>
  );
}

function PrivacyControls({
  confidential,
  onConfidential,
  aiAvailable,
  useAi,
  onUseAi,
  ai,
  preview,
}: {
  confidential: boolean;
  onConfidential: (v: boolean) => void;
  aiAvailable: boolean;
  useAi: boolean;
  onUseAi: (v: boolean) => void;
  ai: ReturnType<typeof useAiStatus>;
  preview: ReturnType<typeof redact>;
}) {
  const [show, setShow] = useState(false);
  const aiOn = useAi && aiAvailable && !confidential;
  const total = preview.counts.reduce((n, c) => n + c.count, 0);
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-[13px] text-stone-800">
        <input type="checkbox" className="mt-0.5" checked={confidential} onChange={(e) => onConfidential(e.target.checked)} />
        <span>
          <span className="flex items-center gap-1 font-medium">
            <Lock size={12} /> Confidential
          </span>
          <span className="block text-xs text-stone-500">Stays in this browser. Rule-based checks only; AI review is blocked.</span>
        </span>
      </label>
      <label className={cx("flex items-start gap-2 text-[13px]", aiAvailable && !confidential ? "text-stone-800" : "text-stone-400")}>
        <input type="checkbox" className="mt-0.5" disabled={!aiAvailable || confidential} checked={aiOn} onChange={(e) => onUseAi(e.target.checked)} />
        <span>
          <span className="flex items-center gap-1 font-medium">
            <Sparkles size={12} /> AI jurors {ai?.configured ? `(${ai.provider} · ${ai.model})` : ""}
          </span>
          <span className="block text-xs text-stone-500">
            {confidential
              ? "Off because this content is confidential."
              : !ai
                ? "Checking configuration…"
                : !ai.configured
                  ? "Not configured on this deployment. Rule-based checks still run."
                  : ai.verified === "no"
                    ? ai.message
                    : `Redacted text goes to the ${ai?.service ?? "AI provider"} and is logged in Settings.`}
          </span>
        </span>
      </label>
      {!confidential && (
        <div>
          <button className="text-xs text-accent-700 hover:underline" onClick={() => setShow(!show)}>
            {show ? "Hide" : "Preview"} what {aiOn ? "will be" : "would be"} sent to AI{total ? ` (${total} redaction${total > 1 ? "s" : ""})` : ""}
          </button>
          {show && (
            <div className="animate-fade-up mt-1.5 rounded-md border border-stone-200 bg-stone-50 p-2">
              <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-stone-700">{preview.text || "(empty)"}</p>
              <p className="mt-1 text-[11px] text-stone-500">
                {preview.counts.length ? preview.counts.map((c) => `${c.count} ${c.kind}`).join(" · ") : "No emails, phone numbers, card numbers, secrets or confidential terms found."} Brand
                rules and approved facts are also sent. Images, video frames and captions never are.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EditorPanel({
  form,
  patch,
  brand,
  existing,
  dirty,
  confidential,
  onConfidential,
  aiAvailable,
  useAi,
  onUseAi,
  ai,
  onLoadExample,
}: {
  form: Form;
  patch: (p: Partial<Form>) => void;
  brand: Brand;
  existing: boolean;
  dirty: boolean;
  confidential: boolean;
  onConfidential: (v: boolean) => void;
  aiAvailable: boolean;
  useAi: boolean;
  onUseAi: (v: boolean) => void;
  ai: ReturnType<typeof useAiStatus>;
  onLoadExample: (id: string) => void;
}) {
  const state = useAppState()!;
  const patchMeta = (m: Partial<ContentMeta>) => patch({ meta: { ...form.meta, ...m } });
  const fg = normalizeHex(form.meta.fg);
  const bg = normalizeHex(form.meta.bg);
  const contrast = !form.meta.fg && !form.meta.bg ? null : !fg || !bg ? { error: "Enter both colours as hex, e.g. #1C1C1E" } : { ratio: contrastRatio(fg, bg) };
  const media = [form.meta.image && "image", form.meta.video && "video", form.meta.captions && "captions", contrast && "ratio" in contrast && `${contrast.ratio!.toFixed(2)}:1`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 pb-2">
        <DocumentImport onLoad={(d) => patch({ ...d, meta: { ...form.meta, ...(d.meta ?? {}) } })} hasTitle={!!form.title} />
        <select aria-label="Load example" className="ml-auto rounded border-0 bg-transparent py-0 text-xs text-stone-600 hover:bg-stone-100" value="" onChange={(e) => onLoadExample(e.target.value)}>
          <option value="">Load example…</option>
          {EXAMPLES.map((e) => <option key={e.id} value={e.id}>{e.id}: {e.title}</option>)}
        </select>
      </div>
      <label htmlFor="content" className="sr-only">Content</label>
      <textarea
        id="content"
        className="block min-h-[280px] w-full resize-y border-0 px-0 py-4 text-[15px] leading-7 text-stone-900 placeholder:text-stone-400 focus:outline-none"
        placeholder="Write or paste a post, email or page…"
        value={form.text}
        onChange={(e) => patch({ text: e.target.value })}
      />
      <div className="flex items-center justify-between border-t border-stone-200 py-2 text-[11px] text-stone-500">
        <span>{dirty ? "Edits become a new version when you re-run the review." : "The review runs on exactly this text."}</span>
        <span className={cx("tabular-nums", form.text.length > MAX_CHARS && "text-red-600")}>{form.text.length.toLocaleString()} characters</span>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-stone-200 py-3">
        <div>
          <Label htmlFor="brand">Workspace</Label>
          <select id="brand" className={inputCls} value={brand.id} disabled={existing || state.brands.length < 2} onChange={(e) => setActiveBrand(e.target.value)}>
            {state.brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="ctype">Content type</Label>
          <select id="ctype" className={inputCls} value={form.contentType} onChange={(e) => patch({ contentType: e.target.value as ContentType })}>
            {CONTENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <Disclosure title="Media and accessibility" hint="Image, video, captions, alt text and colour contrast" defaultOpen={form.meta.hasImage || !!form.meta.hasVideo || !!form.meta.fg} badge={media ? <span className="text-[11px] text-stone-500">{media}</span> : undefined}>
        <div className="space-y-4">
          <ImagePanel meta={form.meta} brand={brand} onChange={patchMeta} />
          <div className="border-t border-stone-100 pt-3">
            <VideoPanel meta={form.meta} brand={brand} onChange={patchMeta} />
          </div>
          <div className="border-t border-stone-100 pt-3">
            <div className="grid grid-cols-2 gap-3">
              {(["fg", "bg"] as const).map((k) => (
                <div key={k}>
                  <Label htmlFor={k}>{k === "fg" ? "Text colour" : "Background colour"}</Label>
                  <div className="flex gap-1.5">
                    <input
                      type="color"
                      aria-label={`${k === "fg" ? "Text" : "Background"} colour picker`}
                      className="h-8 w-8 shrink-0 cursor-pointer rounded border border-stone-300 p-0.5"
                      value={normalizeHex(form.meta[k]) ?? (k === "fg" ? "#000000" : "#ffffff")}
                      onChange={(e) => patchMeta({ [k]: e.target.value.toUpperCase() })}
                    />
                    <input id={k} className={inputCls} value={form.meta[k]} placeholder={k === "fg" ? "#1C1C1E" : "#FFFFFF"} onChange={(e) => patchMeta({ [k]: e.target.value })} />
                  </div>
                </div>
              ))}
            </div>
            {contrast && "error" in contrast && <p className="mt-2 text-xs text-red-700">{contrast.error}</p>}
            {contrast && "ratio" in contrast && (
              <div className="mt-2 flex items-center gap-3">
                <span className="rounded border border-stone-200 px-2.5 py-1 text-sm font-semibold" style={{ color: fg!, background: bg! }}>Aa</span>
                <span className="text-xs text-stone-700">
                  Contrast <strong className="tabular-nums">{contrast.ratio!.toFixed(2)}:1</strong> ·{" "}
                  {contrast.ratio! >= 4.5 ? <span className="text-emerald-700">passes AA</span> : contrast.ratio! >= 3 ? <span className="text-amber-700">AA large text only</span> : <span className="text-red-700">fails AA</span>}
                </span>
                <button className="ml-auto text-[11px] text-stone-500 underline" onClick={() => patchMeta({ fg: "", bg: "" })}>Clear</button>
              </div>
            )}
          </div>
        </div>
      </Disclosure>

      <Disclosure title="Privacy and AI" hint="Confidential mode, AI jurors and redaction preview" defaultOpen={confidential}>
        <PrivacyControls confidential={confidential} onConfidential={onConfidential} aiAvailable={aiAvailable} useAi={useAi} onUseAi={onUseAi} ai={ai} preview={redact(form.text, brand.sensitiveTerms)} />
      </Disclosure>
    </div>
  );
}
