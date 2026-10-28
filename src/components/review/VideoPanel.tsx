"use client";

import { Captions, Film, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Badge, Button, cx } from "@/components/ui";
import { analyzeVideo, fmtTime, MAX_VIDEO_BYTES, parseCaptions, VIDEO_TYPES } from "@/lib/video/analyze";
import { nearestPaletteColour } from "@/lib/engine/color";
import type { Brand, ContentMeta } from "@/lib/types";
import { fmtBytes } from "./ImagePanel";

const DEMO_VIDEO = { url: "/demo/northstar-promo.mp4", name: "northstar-promo.mp4", type: "video/mp4" };
const DEMO_CAPTIONS = { url: "/demo/northstar-promo.vtt", name: "northstar-promo.vtt" };

export function VideoPanel({ meta, brand, onChange }: { meta: ContentMeta; brand: Brand; onChange: (m: Partial<ContentMeta>) => void }) {
  const videoInput = useRef<HTMLInputElement>(null);
  const capInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const v = meta.video;
  const cap = meta.captions;

  const loadVideo = async (file: File) => {
    setError(null);
    setBusy("Reading video…");
    try {
      const a = await analyzeVideo(file, (d, t) => setBusy(`Sampling frames ${d}/${t}…`));
      onChange({ video: a, hasVideo: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyse the video.");
    } finally {
      setBusy(null);
    }
  };
  const loadCaptions = async (file: File) => {
    setError(null);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("Caption file is larger than 2 MB.");
      onChange({ captions: parseCaptions(await file.text(), file.name), hasVideo: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the captions.");
    }
  };
  const demo = async () => {
    const [vr, cr] = await Promise.all([fetch(DEMO_VIDEO.url), fetch(DEMO_CAPTIONS.url)]);
    if (!vr.ok || !cr.ok) return setError("Could not load the demo video.");
    await loadCaptions(new File([await cr.text()], DEMO_CAPTIONS.name, { type: "text/vtt" }));
    await loadVideo(new File([await vr.blob()], DEMO_VIDEO.name, { type: DEMO_VIDEO.type }));
  };

  const coverage = v && cap ? Math.round((cap.cues.reduce((n, c) => n + c.end - c.start, 0) / v.duration) * 100) : null;
  const maxCps = cap ? Math.max(...cap.cues.map((c) => c.text.length / (c.end - c.start))) : 0;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-stone-800">
        <input
          type="checkbox"
          checked={!!meta.hasVideo}
          onChange={(e) => onChange(e.target.checked ? { hasVideo: true } : { hasVideo: false, video: undefined, captions: undefined })}
        />
        Content includes a video
      </label>
      {meta.hasVideo && (
        <>
          {v ? (
            <div className="rounded-lg border border-stone-200 p-2.5">
              <div className="flex items-start gap-2">
                <Film size={15} className="mt-0.5 text-stone-500" />
                <div className="min-w-0 flex-1 text-[11px] text-stone-600">
                  <div className="truncate text-xs font-medium text-stone-900">{v.fileName}</div>
                  {v.width}×{v.height}px · {v.duration.toFixed(1)}s · {fmtBytes(v.bytes)} · {v.frames.length} frames sampled
                </div>
                <button aria-label="Remove video" className="text-stone-400 hover:text-red-600" onClick={() => onChange({ video: undefined })}>
                  <Trash2 size={14} />
                </button>
              </div>
              <ol className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6" aria-label="Sampled frames">
                {v.frames.map((f) => {
                  const off = f.palette.filter((c) => c.share >= 0.08 && nearestPaletteColour(c.hex, brand.palette).distance > 20).reduce((n, c) => n + c.share, 0) >= 0.4;
                  return (
                    <li key={f.t} className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL frame */}
                      <img src={f.thumb} alt={`Frame at ${fmtTime(f.t)}`} className={cx("aspect-video w-full rounded object-cover ring-2", off ? "ring-amber-500" : "ring-transparent")} />
                      <span className={cx("text-[10px]", off ? "font-medium text-amber-700" : "text-stone-500")}>{fmtTime(f.t)}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-1.5 text-[10px] text-stone-500">Orange outline: at least 40% of the frame is outside the approved palette.</p>
            </div>
          ) : (
            <div
              className="rounded-lg border border-dashed border-stone-300 p-3 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f && /\.(vtt|srt)$/i.test(f.name)) loadCaptions(f);
                else if (f) loadVideo(f);
              }}
            >
              <div className="flex flex-wrap justify-center gap-1.5">
                <Button size="sm" disabled={!!busy} onClick={() => videoInput.current?.click()}>
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Film size={13} />} Upload video
                </Button>
                <Button size="sm" variant="ghost" disabled={!!busy} onClick={demo}>
                  Use demo video + captions
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-stone-500">{busy ?? `MP4, WebM, Ogg or MOV · max ${MAX_VIDEO_BYTES / 1024 / 1024} MB`}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 px-2.5 py-2 text-xs">
            <Captions size={14} className="text-stone-500" />
            {cap ? (
              <>
                <span className="font-medium text-stone-800">{cap.fileName}</span>
                <Badge tone="outline">{cap.cues.length} cues</Badge>
                {coverage !== null && <Badge tone={coverage < 60 ? "amber" : "outline"}>{coverage}% of runtime</Badge>}
                <Badge tone={maxCps > 20 ? "amber" : "outline"}>max {Math.round(maxCps)} chars/s</Badge>
                <button aria-label="Remove captions" className="ml-auto text-stone-400 hover:text-red-600" onClick={() => onChange({ captions: undefined })}>
                  <Trash2 size={13} />
                </button>
              </>
            ) : (
              <>
                <span className="text-stone-600">No captions attached</span>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => capInput.current?.click()}>
                  Attach .vtt / .srt
                </Button>
              </>
            )}
          </div>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <p className="text-[11px] text-stone-500">
            Frames are sampled in your browser and never uploaded. Audio isn’t transcribed. Attach captions so the jury can check what’s said: spoken claims are reviewed
            through the caption text.
          </p>
          <input
            ref={videoInput}
            type="file"
            accept={VIDEO_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadVideo(f);
              e.target.value = "";
            }}
          />
          <input
            ref={capInput}
            type="file"
            accept=".vtt,.srt,text/vtt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadCaptions(f);
              e.target.value = "";
            }}
          />
        </>
      )}
    </div>
  );
}
