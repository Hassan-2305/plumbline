// Colour-distance and perceptual-hash helpers. Pure functions, no DOM.

import { normalizeHex } from "./contrast";

function hexToRgb(hex: string): [number, number, number] {
  const n = normalizeHex(hex) ?? "#000000";
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
}

export function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function toLab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  // D65 white point
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 ΔE. ~2 is barely perceptible; >20 reads as a different colour. */
export function deltaE(a: string, b: string) {
  const [l1, a1, b1] = toLab(hexToRgb(a));
  const [l2, a2, b2] = toLab(hexToRgb(b));
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

export function nearestPaletteColour(hex: string, palette: { name: string; hex: string }[]) {
  let best = { name: "", hex: "", distance: Infinity };
  for (const p of palette) {
    const d = deltaE(hex, p.hex);
    if (d < best.distance) best = { name: p.name, hex: p.hex, distance: d };
  }
  return best;
}

/** Similarity of two 64-bit dHashes (hex strings), 0..1. */
export function hashSimilarity(a: string, b: string) {
  if (a.length !== 16 || b.length !== 16) return 0;
  let diff = 0;
  for (let i = 0; i < 16; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      diff += x & 1;
      x >>= 1;
    }
  }
  return 1 - diff / 64;
}
