"use client";

import type { ImageAnalysis } from "../types";
import { deltaE, rgbToHex } from "../engine/color";

// Browser-only image inspection with <canvas>. The file never leaves the
// browser and is never sent to an AI model.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The file could not be decoded as an image."));
    img.src = url;
  });
}

export function canvasFor(img: CanvasImageSource, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#FFFFFF"; // transparent areas read as white
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { c, ctx };
}

export function dominantColours(img: CanvasImageSource, w: number, h: number) {
  const scale = Math.min(1, 120 / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * scale));
  const sh = Math.max(1, Math.round(h * scale));
  const { ctx } = canvasFor(img, sw, sh);
  const data = ctx.getImageData(0, 0, sw, sh).data;
  // 4-bit-per-channel buckets, averaged back to real colours.
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const bk = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bk.r += data[i];
    bk.g += data[i + 1];
    bk.b += data[i + 2];
    bk.n++;
    buckets.set(key, bk);
  }
  const total = sw * sh;
  const merged: { hex: string; n: number }[] = [];
  for (const bk of [...buckets.values()].sort((a, b) => b.n - a.n)) {
    const hex = rgbToHex(bk.r / bk.n, bk.g / bk.n, bk.b / bk.n);
    const near = merged.find((m) => deltaE(m.hex, hex) < 12);
    if (near) near.n += bk.n;
    else merged.push({ hex, n: bk.n });
  }
  return merged
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((m) => ({ hex: m.hex, share: Math.round((m.n / total) * 1000) / 1000 }))
    .filter((m) => m.share >= 0.02);
}

/** dHash: 9×8 greyscale, compare horizontal neighbours → 64 bits. */
function differenceHash(img: HTMLImageElement) {
  const { ctx } = canvasFor(img, 9, 8);
  const d = ctx.getImageData(0, 0, 9, 8).data;
  const grey = (x: number, y: number) => {
    const i = (y * 9 + x) * 4;
    return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  };
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += grey(x, y) > grey(x + 1, y) ? "1" : "0";
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export async function analyzeImage(file: File): Promise<ImageAnalysis> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error(`Unsupported file type "${file.type || "unknown"}". Use PNG, JPEG, WebP, GIF or SVG.`);
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image is larger than 5 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) throw new Error("The image has no measurable dimensions.");
    const t = Math.min(1, 240 / Math.max(width, height));
    const { c } = canvasFor(img, Math.max(1, Math.round(width * t)), Math.max(1, Math.round(height * t)));
    return {
      fileName: file.name,
      mimeType: file.type,
      bytes: file.size,
      width,
      height,
      thumb: c.toDataURL("image/png"),
      palette: dominantColours(img, width, height),
      dHash: differenceHash(img),
      analyzedAt: new Date().toISOString(),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Fetches a bundled demo asset and analyses it like an upload. */
export async function analyzeUrl(url: string, name: string): Promise<ImageAnalysis> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${name}.`);
  const blob = await res.blob();
  return analyzeImage(new File([blob], name, { type: blob.type || "image/svg+xml" }));
}
