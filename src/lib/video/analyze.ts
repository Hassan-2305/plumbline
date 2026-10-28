"use client";

import type { CaptionCue, CaptionTrack, VideoAnalysis } from "../types";
import { canvasFor, dominantColours } from "../image/analyze";

// Browser-only video inspection: metadata and sampled frames via <video> + <canvas>.
// Audio is not analysed and nothing is uploaded.

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];

function once(el: HTMLMediaElement, event: string, ms = 8000) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      cleanup();
      reject(new Error("The video took too long to respond."));
    }, ms);
    const ok = () => {
      cleanup();
      resolve();
    };
    const err = () => {
      cleanup();
      reject(new Error("This browser can’t decode this video. Try MP4 (H.264) or WebM."));
    };
    const cleanup = () => {
      clearTimeout(t);
      el.removeEventListener(event, ok);
      el.removeEventListener("error", err);
    };
    el.addEventListener(event, ok);
    el.addEventListener("error", err);
  });
}

export async function analyzeVideo(file: File, onProgress?: (done: number, total: number) => void): Promise<VideoAnalysis> {
  if (file.type && !VIDEO_TYPES.includes(file.type)) throw new Error(`Unsupported video type "${file.type}". Use MP4, WebM, Ogg or MOV.`);
  if (file.size > MAX_VIDEO_BYTES) throw new Error("Video is larger than 100 MB.");
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.preload = "auto";
  v.playsInline = true;
  try {
    v.src = url;
    await once(v, "loadeddata", 15000);
    const duration = v.duration;
    const width = v.videoWidth;
    const height = v.videoHeight;
    if (!isFinite(duration) || duration <= 0 || !width) throw new Error("Couldn’t read the video’s duration or size.");
    const total = Math.min(12, Math.max(4, Math.ceil(duration / 2)));
    const tw = 160;
    const th = Math.max(1, Math.round((tw * height) / width));
    const frames: VideoAnalysis["frames"] = [];
    for (let i = 0; i < total; i++) {
      const t = Math.min(duration - 0.05, ((i + 0.5) * duration) / total);
      v.currentTime = t;
      await once(v, "seeked");
      const { c } = canvasFor(v, tw, th);
      frames.push({ t: Math.round(t * 100) / 100, thumb: c.toDataURL("image/jpeg", 0.7), palette: dominantColours(v, width, height) });
      onProgress?.(i + 1, total);
    }
    return { fileName: file.name, mimeType: file.type || "video/mp4", bytes: file.size, duration, width, height, frames, analyzedAt: new Date().toISOString() };
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}

const TIME = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})/;
function seconds(s: string) {
  const m = s.match(TIME);
  if (!m) return NaN;
  return (m[1] ? +m[1] * 3600 : 0) + +m[2] * 60 + +m[3] + +m[4] / 1000;
}

/** Parses WebVTT or SRT. Styling tags are stripped. */
export function parseCaptions(text: string, fileName: string): CaptionTrack {
  const cues: CaptionCue[] = [];
  for (const block of text.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n").filter(Boolean);
    const idx = lines.findIndex((l) => l.includes("-->"));
    if (idx < 0) continue;
    const [a, b] = lines[idx].split("-->");
    const start = seconds(a);
    const end = seconds(b);
    const body = lines
      .slice(idx + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (isFinite(start) && isFinite(end) && end > start && body) cues.push({ start, end, text: body });
  }
  if (!cues.length) throw new Error("No caption cues found. Use a WebVTT (.vtt) or SubRip (.srt) file.");
  return { fileName, cues };
}

export function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
