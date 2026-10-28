// Redaction before any external AI call. Pure functions so they can be unit-tested.
// Placeholders are restored in the AI results, so findings still point at the real text.

export interface Redaction {
  placeholder: string;
  original: string;
  kind: RedactionKind;
}

export type RedactionKind = "email" | "phone" | "card" | "secret" | "confidential term";

export interface RedactionResult {
  text: string;
  redactions: Redaction[];
  counts: { kind: RedactionKind; count: number }[];
}

const PATTERNS: { kind: RedactionKind; re: RegExp; label: string }[] = [
  { kind: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, label: "EMAIL" },
  // Long digit runs that look like payment cards (13–19 digits, optional separators).
  { kind: "card", re: /\b(?:\d[ -]?){13,19}\b/g, label: "CARD" },
  { kind: "phone", re: /(?<![\w.])\+?\d[\d ().-]{7,}\d(?![\w.])/g, label: "PHONE" },
  // API keys / tokens: long mixed strings with no spaces.
  { kind: "secret", re: /\b(?=[A-Za-z0-9_-]{24,}\b)(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]+\b/g, label: "SECRET" },
];

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redact(input: string, sensitiveTerms: string[] = []): RedactionResult {
  const redactions: Redaction[] = [];
  const seen = new Map<string, string>();
  const counters: Record<string, number> = {};
  const swap = (original: string, kind: RedactionKind, label: string) => {
    const key = `${kind}:${original.toLowerCase()}`;
    let ph = seen.get(key);
    if (!ph) {
      counters[label] = (counters[label] ?? 0) + 1;
      ph = `[${label}-${counters[label]}]`;
      seen.set(key, ph);
    }
    redactions.push({ placeholder: ph, original, kind });
    return ph;
  };

  let text = input;
  // Confidential terms first (longest first so "Project Polaris X" beats "Project Polaris").
  for (const term of [...sensitiveTerms].filter((t) => t.trim().length > 1).sort((a, b) => b.length - a.length)) {
    text = text.replace(new RegExp(`(?<![\\w])${escapeRe(term.trim())}(?![\\w])`, "gi"), (m) => swap(m, "confidential term", "CONFIDENTIAL"));
  }
  for (const p of PATTERNS) {
    text = text.replace(p.re, (m) => (/^\[[A-Z]+-\d+\]$/.test(m) ? m : swap(m, p.kind, p.label)));
  }
  const counts = (["email", "phone", "card", "secret", "confidential term"] as RedactionKind[])
    .map((kind) => ({ kind, count: redactions.filter((r) => r.kind === kind).length }))
    .filter((c) => c.count > 0);
  return { text, redactions, counts };
}

/** Puts original values back into model output (quotes, fixes, explanations). */
export function restore(text: string | undefined, redactions: Redaction[]): string | undefined {
  if (text === undefined) return text;
  let out = text;
  const unique = new Map(redactions.map((r) => [r.placeholder, r.original]));
  for (const [ph, original] of unique) out = out.split(ph).join(original);
  return out;
}
