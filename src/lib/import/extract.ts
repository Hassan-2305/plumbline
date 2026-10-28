"use client";

import type { RuleRole } from "../types";

// Brand-book import. Text is extracted in the browser (pdf.js for PDFs); nothing
// is uploaded unless the user explicitly asks for AI extraction.

export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

export interface ExtractedDoc {
  fileName: string;
  kind: "pdf" | "docx" | "text";
  bytes: number;
  pages: { page: number; text: string }[];
  chars: number;
}

export interface Candidate {
  id: string;
  kind: "rule" | "banned" | "preferred";
  text: string;
  page: number;
  role?: RuleRole;
  term?: string;
  avoid?: string[];
  source: "pattern" | "ai";
  title?: string;
}

export async function extractDocument(file: File): Promise<ExtractedDoc> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("File is larger than 15 MB.");
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return extractPdf(file);
  if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return extractDocx(file);
  if (/\.(txt|md|markdown)$/.test(name) || file.type.startsWith("text/")) {
    const text = await file.text();
    return { fileName: file.name, kind: "text", bytes: file.size, pages: [{ page: 1, text }], chars: text.length };
  }
  throw new Error("Unsupported file. Use PDF, Word (.docx), .txt or .md.");
}

async function extractDocx(file: File): Promise<ExtractedDoc> {
  const mammoth = await import("mammoth");
  let text: string;
  try {
    text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  } catch {
    throw new Error("This Word file could not be read. It may be damaged or an older .doc file.");
  }
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 5) throw new Error("No text found in this Word file.");
  // Word files have no fixed pages; the whole document is treated as one section.
  return { fileName: file.name, kind: "docx", bytes: file.size, pages: [{ page: 1, text }], chars: text.length };
}

async function extractPdf(file: File): Promise<ExtractedDoc> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch {
    throw new Error("This PDF could not be opened. It may be encrypted or damaged.");
  }
  const pages: ExtractedDoc["pages"] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 80); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str + (item.hasEOL ? "\n" : " ");
    }
    pages.push({ page: p, text: text.replace(/[ \t]+\n/g, "\n").trim() });
  }
  const chars = pages.reduce((n, p) => n + p.text.length, 0);
  if (chars < 20) throw new Error("No selectable text found. Scanned (image-only) PDFs aren’t supported — OCR is not available.");
  return { fileName: file.name, kind: "pdf", bytes: file.size, pages, chars };
}

const DIRECTIVE = /\b(must|should|never|always|avoid|do not|don't|use|prefer|required?|ensure|ban(?:ned)?|no more than|at least)\b|\b(?:our|the) (?:brand )?(?:voice|tone) is\b/i;

export function suggestRole(text: string): RuleRole | undefined {
  const t = text.toLowerCase();
  if (/superlative|sensational|guarantee|exaggerat|hype/.test(t)) return "sensational";
  if (/expire|expiry|older than|out of date|outdated/.test(t)) return "expiry";
  if (/number|numerical|percentage|statistic|figure/.test(t)) return "numbers";
  if (/health|clinical|medical|financial|environmental|claim|evidence|substantiat/.test(t)) return "health";
  if (/accessib|alt text|contrast|caption|screen reader|wcag/.test(t)) return "accessibility";
  if (/logo|colou?r|palette|typeface|font|imagery/.test(t)) return "visual";
  return undefined;
}

// Double quotes delimit terms so apostrophes inside them (world’s) survive.
const QUOTE = `["“”]`;

/** Pattern-based candidates. Every candidate quotes text that exists in the document. */
export function findCandidates(doc: ExtractedDoc): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  let n = 0;
  for (const { page, text } of doc.pages) {
    const units = text
      .split(/\n+|(?<=[.!?])\s+(?=[A-Z•\-–*])/)
      .map((l) => l.replace(/^[\s•\-–*·\d.)]+/, "").trim())
      .filter((l) => l.length >= 18 && l.length <= 320);
    for (const u of units) {
      const key = u.toLowerCase();
      if (seen.has(key) || !DIRECTIVE.test(u)) continue;
      seen.add(key);
      const banned = u.match(new RegExp(`(?:never use|do not use|don't use|avoid|ban(?:ned)?)(?:\\s+(?:the|a|any))?(?:\\s+(?:word|phrase|term|expression)s?)?[:\\s]+${QUOTE}([^"“”]{2,50})${QUOTE}`, "i"));
      const preferred = u.match(new RegExp(`(?:use|say|write)\\s+${QUOTE}([^"“”]{2,50})${QUOTE}\\s+(?:instead of|not|rather than)\\s+${QUOTE}([^"“”]{2,50})${QUOTE}`, "i"));
      out.push({ id: `c${n++}`, kind: "rule", text: u, page, role: suggestRole(u), source: "pattern" });
      if (banned) out.push({ id: `c${n++}`, kind: "banned", text: u, page, term: banned[1].trim(), source: "pattern" });
      if (preferred) out.push({ id: `c${n++}`, kind: "preferred", text: u, page, term: preferred[1].trim(), avoid: [preferred[2].trim()], source: "pattern" });
    }
  }
  return out.slice(0, 80);
}

/** Hex colours mentioned with a nearby name, e.g. "Roast Brown #4A2C2A". */
export function findColours(doc: ExtractedDoc) {
  const out: { name: string; hex: string }[] = [];
  for (const { text } of doc.pages) {
    for (const m of text.matchAll(/([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?)\s*\(?\s*(#[0-9A-Fa-f]{6})\b/g)) {
      if (!out.some((c) => c.hex.toUpperCase() === m[2].toUpperCase())) out.push({ name: m[1], hex: m[2].toUpperCase() });
    }
  }
  return out;
}

export function ruleTitle(text: string) {
  const words = text.replace(/["“”]/g, "").split(/\s+/).slice(0, 6).join(" ");
  return words.length < text.length ? `${words}…` : words;
}
