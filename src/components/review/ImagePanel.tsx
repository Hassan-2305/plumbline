"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Badge, Button, Label, cx, inputCls } from "@/components/ui";
import { ACCEPTED_TYPES, analyzeImage, analyzeUrl } from "@/lib/image/analyze";
import { nearestPaletteColour } from "@/lib/engine/color";
import type { Brand, ContentMeta, ImageAnalysis } from "@/lib/types";

export const DEMO_IMAGES = [
  { url: "/demo/northstar-logo.svg", name: "northstar-logo.svg", label: "Approved logo", logo: true },
  { url: "/demo/northstar-logo-stretched.svg", name: "northstar-logo-stretched.svg", label: "Stretched logo", logo: true },
  { url: "/demo/offbrand-banner.svg", name: "offbrand-banner.svg", label: "Off-brand banner", logo: false },
];

export function fmtBytes(n: number) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function ImageFacts({ img, brand }: { img: ImageAnalysis; brand: Brand }) {
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-[80px_1fr] gap-y-0.5 text-[11px]">
        <dt className="text-stone-500">File</dt>
        <dd className="truncate text-stone-800">{img.fileName}</dd>
        <dt className="text-stone-500">Type</dt>
        <dd className="text-stone-800">{img.mimeType}</dd>
        <dt className="text-stone-500">Dimensions</dt>
        <dd className="text-stone-800">
          {img.width} × {img.height}px · ratio {(img.width / img.height).toFixed(2)}
        </dd>
        <dt className="text-stone-500">Size</dt>
        <dd className="text-stone-800">{fmtBytes(img.bytes)}</dd>
      </dl>
      <div>
        <div className="text-[11px] text-stone-500 mb-1">Dominant colours vs approved palette</div>
        <ul className="space-y-0.5">
          {img.palette.map((c) => {
            const near = nearestPaletteColour(c.hex, brand.palette);
            const ok = near.distance <= 20;
            return (
              <li key={c.hex} className="flex items-center gap-1.5 text-[11px]">
                <span className="h-3.5 w-3.5 rounded-sm border border-stone-300" style={{ background: c.hex }} />
                <span className="font-mono">{c.hex}</span>
                <span className="text-stone-500">{Math.round(c.share * 100)}%</span>
                <span className={cx("ml-auto", ok ? "text-emerald-700" : "text-orange-700")}>
                  {ok ? "≈" : "≠"} {near.name} (ΔE {near.distance.toFixed(0)})
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function ImagePanel({ meta, brand, onChange }: { meta: ContentMeta; brand: Brand; onChange: (m: Partial<ContentMeta>) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const img = meta.image;

  const run = async (p: Promise<ImageAnalysis>, isLogo?: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const a = await p;
      onChange({ image: a, hasImage: true, ...(isLogo !== undefined ? { isLogoAsset: isLogo } : {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyse the image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-stone-800">
        <input type="checkbox" checked={meta.hasImage} onChange={(e) => onChange({ hasImage: e.target.checked, ...(e.target.checked ? {} : { image: undefined, isLogoAsset: false }) })} />
        Content includes an image
      </label>
      {meta.hasImage && (
        <>
          {img ? (
            <div className="flex gap-3 rounded border border-stone-200 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
              <img src={img.thumb} alt={meta.altText || "Uploaded image preview (no alt text yet)"} className="h-20 w-28 shrink-0 rounded border border-stone-200 object-contain bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]" />
              <div className="min-w-0 flex-1">
                <ImageFacts img={img} brand={brand} />
              </div>
              <button aria-label="Remove image" className="self-start text-stone-400 hover:text-red-600" onClick={() => onChange({ image: undefined, isLogoAsset: false })}>
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) run(analyzeImage(f));
              }}
              className="rounded border border-dashed border-stone-300 p-3 text-center"
            >
              <Button size="sm" onClick={() => input.current?.click()} disabled={busy}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} Upload image
              </Button>
              <p className="mt-1 text-[11px] text-stone-500">or drop a file · PNG, JPEG, WebP, GIF, SVG · max 5 MB</p>
              <div className="mt-2 flex flex-wrap justify-center gap-1">
                {DEMO_IMAGES.map((d) => (
                  <button key={d.url} disabled={busy} onClick={() => run(analyzeUrl(d.url, d.name), d.logo)} className="rounded border border-stone-300 px-1.5 py-0.5 text-[11px] text-stone-700 hover:bg-stone-50">
                    Demo: {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <input
            ref={input}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) run(analyzeImage(f));
              e.target.value = "";
            }}
          />
          {error && <p className="text-xs text-red-700">{error}</p>}
          {img && (
            <label className="flex items-center gap-2 text-xs text-stone-700">
              <input type="checkbox" checked={!!meta.isLogoAsset} onChange={(e) => onChange({ isLogoAsset: e.target.checked })} />
              This file is a logo — compare it with the approved reference
              {!brand.logo && <Badge tone="amber">No reference set</Badge>}
            </label>
          )}
          <div>
            <Label htmlFor="alt">Alt text</Label>
            <input id="alt" className={inputCls} value={meta.altText} onChange={(e) => onChange({ altText: e.target.value })} placeholder="Describe the image’s purpose" />
          </div>
          <p className="text-[11px] text-stone-500">
            Images are inspected in your browser only (size, colours, similarity hash) and are never sent to the AI. Nothing judges what the image depicts.
          </p>
        </>
      )}
    </div>
  );
}
