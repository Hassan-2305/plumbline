// Text helpers shared by deterministic checks and fix application.

export interface Span {
  start: number;
  end: number;
  text: string;
}

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive, whole-word occurrences; returns the exact source substring. */
export function findPhrase(text: string, phrase: string): Span[] {
  // Straight and curly apostrophes/quotes are treated as the same character.
  const pattern = escapeRegExp(phrase).replace(/['’‘]/g, "['’‘]").replace(/["“”]/g, '["“”]');
  const re = new RegExp(`(?<![\\w-])${pattern}(?![\\w-])`, "gi");
  const out: Span[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return out;
}

export function sentences(text: string): Span[] {
  const out: Span[] = [];
  const re = /[^.!?\n]+[.!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (t.length) out.push({ start: m.index + lead, end: m.index + lead + t.length, text: t });
  }
  return out;
}

export function sentenceAt(text: string, index: number): Span | undefined {
  return sentences(text).find((s) => index >= s.start && index < s.end);
}

export function wordCount(s: string) {
  return s.split(/\s+/).filter(Boolean).length;
}

export interface NumberToken {
  raw: string;
  value: string;
  unit: string;
  start: number;
}

const NUM_RE =
  /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(%|g\b|grams?\b|mg\b|kcal\b|calories\b|x\b|times\b|\/\s?5\b|out of 5\b)?(\+)?/gi;

/** Extracts claim-like numbers: with a unit, decimals, or thousands separators. Skips bare years. */
export function numberTokens(text: string): NumberToken[] {
  const out: NumberToken[] = [];
  let m: RegExpExecArray | null;
  NUM_RE.lastIndex = 0;
  while ((m = NUM_RE.exec(text))) {
    const value = m[1];
    let unit = (m[2] || "").toLowerCase().replace(/\s/g, "");
    if (unit === "gram" || unit === "grams") unit = "g";
    if (unit === "times") unit = "x";
    if (unit === "outof5") unit = "/5";
    const claimLike = unit !== "" || value.includes(".") || value.includes(",");
    const isYear = !unit && /^(19|20)\d{2}$/.test(value);
    // ignore digits that are part of an identifier like "F-001" or a word like "b12"
    const prev = text[m.index - 1];
    if (prev && /[A-Za-z-]/.test(prev)) continue;
    if (!claimLike || isYear) continue;
    out.push({ raw: m[0].trim(), value: value.replace(/,/g, ""), unit, start: m.index });
  }
  return out;
}

export function sameNumber(a: NumberToken, b: NumberToken) {
  return parseFloat(a.value) === parseFloat(b.value) && (a.unit === b.unit || !a.unit || !b.unit);
}
