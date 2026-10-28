import type { DocumentMeta } from "../types";

// Maps character offsets in a reviewed document back to its pages.

export function joinPages(pages: { page: number; text: string }[]) {
  let text = "";
  const ranges: DocumentMeta["pages"] = [];
  for (const p of pages) {
    if (text) text += "\n\n";
    const start = text.length;
    text += p.text;
    ranges.push({ page: p.page, start, end: text.length });
  }
  return { text, ranges };
}

export function pageAt(ranges: DocumentMeta["pages"], index: number): number | undefined {
  if (index < 0 || !ranges.length) return undefined;
  return (ranges.find((r) => index >= r.start && index <= r.end) ?? ranges[ranges.length - 1]).page;
}

/** Page for a quote in the current text (approximate once the text has been edited). */
export function pageOfQuote(doc: DocumentMeta | undefined, text: string, quote?: string) {
  if (!doc || !quote || doc.pages.length < 2) return undefined;
  return pageAt(doc.pages, text.toLowerCase().indexOf(quote.toLowerCase()));
}
