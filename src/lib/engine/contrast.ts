// WCAG 2.x contrast ratio — real calculation, no estimation.

export function normalizeHex(input: string): string | null {
  const v = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    return ("#" + v.split("").map((c) => c + c).join("")).toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(v)) return ("#" + v).toUpperCase();
  return null;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const n = normalizeHex(hex);
  if (!n) throw new Error(`Invalid colour: ${hex}`);
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(fg: string, bg: string): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export function wcagLevels(ratio: number) {
  return {
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
  };
}
