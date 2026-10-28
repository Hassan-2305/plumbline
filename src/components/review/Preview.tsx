"use client";

import { FileText, ImageOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { cx } from "@/components/ui";
import { BrandMark } from "@/components/brands/BrandSwitcher";
import { normalizeHex } from "@/lib/engine/contrast";
import type { Brand, ContentItem, ContentMeta, ContentType, Finding, Severity } from "@/lib/types";

const SEV_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const isOpen = (f: Finding) => f.status === "open" || f.status === "escalated";

/** Text with open findings highlighted by severity. Clicking a highlight selects its finding. */
export function AnnotatedText({
  text,
  findings,
  selectedId,
  onSelect,
  className,
}: {
  text: string;
  findings: Finding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const selRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Bring the selected passage into view when a finding is chosen in the panel.
    selRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const lower = text.toLowerCase();
  const ranges: { start: number; end: number; f: Finding }[] = [];
  for (const f of [...findings.filter(isOpen)].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity])) {
    if (!f.offendingText || f.location) continue;
    const start = lower.indexOf(f.offendingText.toLowerCase());
    if (start < 0) continue;
    const end = start + f.offendingText.length;
    if (ranges.some((r) => start < r.end && end > r.start)) continue;
    ranges.push({ start, end, f });
  }
  ranges.sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  ranges.forEach((r, i) => {
    if (r.start > pos) parts.push(text.slice(pos, r.start));
    const sev = r.f.severity;
    const selected = selectedId === r.f.id;
    parts.push(
      <button
        key={i}
        ref={selected ? selRef : undefined}
        onClick={() => onSelect(r.f.id)}
        aria-label={`${sev} risk: ${r.f.title}. Show finding.`}
        aria-pressed={selected}
        className={cx(
          "rounded-[2px] text-left underline decoration-2 underline-offset-[3px] transition-colors duration-150",
          sev === "high" ? "decoration-red-500 hover:bg-red-50" : sev === "medium" ? "decoration-amber-500 hover:bg-amber-50" : "decoration-stone-400 hover:bg-stone-100",
          selected && (sev === "high" ? "bg-red-100" : sev === "medium" ? "bg-amber-100" : "bg-stone-200"),
          selected && "animate-locate",
        )}
      >
        {text.slice(r.start, r.end)}
      </button>,
    );
    pos = r.end;
  });
  if (pos < text.length) parts.push(text.slice(pos));
  return <p className={cx("whitespace-pre-wrap", className)}>{parts}</p>;
}

function handle(name: string) {
  return "@" + name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Renders content the way it will be seen, with findings highlighted in place. */
export function ContentPreview({
  item,
  form,
  brand,
  selectedId,
  onSelect,
}: {
  item?: ContentItem;
  form: { title: string; contentType: ContentType; text: string; meta: ContentMeta };
  brand: Brand;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const findings = item?.findings ?? [];
  const text = form.text || "Nothing to preview yet. Switch to Edit to write or paste content.";
  const fg = normalizeHex(form.meta.fg);
  const bg = normalizeHex(form.meta.bg);
  const colourStyle = fg && bg ? { color: fg, background: bg } : undefined;

  if (form.contentType === "Social post") {
    return (
      <div className="mx-auto max-w-[540px] rounded-lg border border-stone-200 bg-white">
        <div className="flex items-center gap-2.5 px-4 pt-4">
          <BrandMark brand={brand} size={36} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-stone-900">{brand.name}</div>
            <div className="text-xs text-stone-500">{handle(brand.name)} · draft</div>
          </div>
        </div>
        <div className="px-4 py-3">
          <AnnotatedText text={text} findings={findings} selectedId={selectedId} onSelect={onSelect} className="text-[15px] leading-relaxed text-stone-900" />
        </div>
        {form.meta.hasImage && (
          <div className="border-t border-stone-200">
            {form.meta.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
              <img src={form.meta.image.thumb} alt={form.meta.altText || ""} className="max-h-72 w-full bg-stone-50 object-contain" />
            ) : (
              <div className="flex h-32 items-center justify-center gap-2 bg-stone-50 text-xs text-stone-500">
                <ImageOff size={14} /> Image attached (no file uploaded)
              </div>
            )}
            <div className={cx("px-4 py-2 text-[11px]", form.meta.altText ? "text-stone-500" : "text-amber-700")}>
              {form.meta.altText ? `Alt text: ${form.meta.altText}` : "No alt text"}
            </div>
          </div>
        )}
        <div className="flex justify-between border-t border-stone-200 px-4 py-2 text-[11px] text-stone-500">
          <span>{form.text.length} characters</span>
          <span>Preview · not published</span>
        </div>
      </div>
    );
  }

  if (form.contentType === "Marketing email") {
    const m = text.match(/^\s*Subject:\s*(.+)\n?/i);
    const subject = m ? m[1] : form.title || "(no subject)";
    const body = m ? text.slice(m[0].length).replace(/^\n+/, "") : text;
    return (
      <div className="mx-auto max-w-[640px] rounded-lg border border-stone-200 bg-white">
        <dl className="grid grid-cols-[64px_1fr] gap-y-1 border-b border-stone-200 px-5 py-3 text-[13px]">
          <dt className="text-stone-500">From</dt>
          <dd className="text-stone-900">{brand.name}</dd>
          <dt className="text-stone-500">Subject</dt>
          <dd className="font-medium text-stone-900">
            <AnnotatedText text={subject} findings={findings} selectedId={selectedId} onSelect={onSelect} />
          </dd>
        </dl>
        <div className="px-5 py-5" style={colourStyle}>
          <AnnotatedText text={body} findings={findings} selectedId={selectedId} onSelect={onSelect} className="text-[14px] leading-7 text-inherit" />
        </div>
      </div>
    );
  }

  // Web copy, ads, press releases and documents render as a page.
  return (
    <div className="mx-auto max-w-[720px] rounded-lg border border-stone-200 bg-white">
      {form.meta.document && (
        <div className="flex items-center gap-2 border-b border-stone-200 px-5 py-2 text-xs text-stone-500">
          <FileText size={13} /> {form.meta.document.fileName} · {form.meta.document.pages.length} page{form.meta.document.pages.length === 1 ? "" : "s"}
        </div>
      )}
      <div className="px-6 py-6" style={colourStyle}>
        <AnnotatedText text={text} findings={findings} selectedId={selectedId} onSelect={onSelect} className={cx("leading-7", colourStyle ? "text-inherit" : "text-stone-900", "text-[15px]")} />
      </div>
      {fg && bg && <div className="border-t border-stone-200 px-5 py-1.5 text-[11px] text-stone-500">Rendered with the supplied text and background colours</div>}
    </div>
  );
}
