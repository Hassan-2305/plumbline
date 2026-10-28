import { describe, expect, it } from "vitest";
import { applyChange, applyClarification, testChange } from "@/lib/engine/impact";
import { NORTHSTAR } from "@/lib/seed/brand";
import { seededHistory } from "@/lib/seed/history";
import { conflictFromDetection, detectConflicts } from "@/lib/engine/conflicts";
import { parseCaptions } from "@/lib/video/analyze";
import { findCandidates, findColours, suggestRole, type ExtractedDoc } from "@/lib/import/extract";
import { joinPages, pageOfQuote } from "@/lib/import/pages";

const TODAY = "2026-10-29";

describe("Test this change (guideline regression testing)", () => {
  const items = seededHistory();
  const conflict = conflictFromDetection(detectConflicts(NORTHSTAR.rules)[0], NORTHSTAR.rules, NORTHSTAR.id);

  it("shows the R-009 clarification removes only findings reviewers dismissed", () => {
    const r = testChange(items, NORTHSTAR, applyClarification(NORTHSTAR, conflict.proposedRuleId, conflict.proposedText), TODAY);
    expect(r.summary.removedDismissed).toBe(4);
    expect(r.summary.lostAccepted).toBe(0);
    expect(r.summary.added).toBe(0);
    expect(r.summary.verdict).toBe("safe");
    expect(r.summary.versionsTested).toBeGreaterThan(items.length);
  });

  it("reports a risky change when real, accepted issues would no longer be caught", () => {
    const weakened = { ...NORTHSTAR, bannedTerms: [], preferredTerms: [] };
    const r = testChange(items, NORTHSTAR, weakened, TODAY);
    expect(r.lostAccepted).toBeGreaterThan(0);
    expect(r.summary.verdict).toBe("risky");
  });

  it("detects approved content that a new banned term would break", () => {
    const stricter = applyChange(NORTHSTAR, { kind: "banned_add", term: "chocolate recipe", ruleId: "R-004" });
    const r = testChange(items, NORTHSTAR, stricter, TODAY);
    expect(r.summary.added).toBeGreaterThan(0);
    expect(r.summary.approvedNowFailing).toBeGreaterThan(0);
    expect(r.summary.verdict).toBe("risky");
  });

  it("an unchanged rule set has no impact", () => {
    const r = testChange(items, NORTHSTAR, NORTHSTAR, TODAY);
    expect(r.summary.removed + r.summary.added).toBe(0);
    expect(r.summary.verdict).toBe("safe");
  });
});

describe("captions parsing", () => {
  it("parses WebVTT and SRT and strips tags", () => {
    const vtt = parseCaptions("WEBVTT\n\n00:00:01.000 --> 00:00:02.500\n<b>Hello</b> there\n", "a.vtt");
    expect(vtt.cues).toEqual([{ start: 1, end: 2.5, text: "Hello there" }]);
    const srt = parseCaptions("1\n00:00:03,000 --> 00:00:04,000\nSecond\n", "b.srt");
    expect(srt.cues[0]).toEqual({ start: 3, end: 4, text: "Second" });
  });
  it("rejects files with no cues", () => {
    expect(() => parseCaptions("not captions", "c.vtt")).toThrow();
  });
});

describe("brand-book import", () => {
  const doc: ExtractedDoc = {
    fileName: "book.pdf",
    kind: "pdf",
    bytes: 1,
    chars: 0,
    pages: [
      {
        page: 1,
        text: 'Our voice is warm, playful and conversational.\nNever use the phrase "world’s best coffee".\nUse "single-origin" instead of "premium beans".\nAurora was founded in a small roastery.\nPrimary colours are Roast Brown #4A2C2A and Cream #F5EBDD.',
      },
    ],
  };
  const c = findCandidates(doc);
  it("finds rules but not background sentences", () => {
    const rules = c.filter((x) => x.kind === "rule").map((x) => x.text);
    expect(rules).toContain("Our voice is warm, playful and conversational.");
    expect(rules.some((r) => r.includes("founded"))).toBe(false);
  });
  it("detects banned and preferred terms with apostrophes intact", () => {
    expect(c.find((x) => x.kind === "banned")?.term).toBe("world’s best coffee");
    expect(c.find((x) => x.kind === "preferred")).toMatchObject({ term: "single-origin", avoid: ["premium beans"] });
  });
  it("detects named colours and suggests check categories", () => {
    expect(findColours(doc)).toEqual([
      { name: "Roast Brown", hex: "#4A2C2A" },
      { name: "Cream", hex: "#F5EBDD" },
    ]);
    expect(suggestRole("Numerical claims must match the fact sheet.")).toBe("numbers");
    expect(suggestRole("All videos must include captions.")).toBe("accessibility");
  });
});

describe("document pages", () => {
  it("maps quotes back to their page", () => {
    const { text, ranges } = joinPages([
      { page: 1, text: "First page copy." },
      { page: 2, text: "Clinically proven claim here." },
    ]);
    const doc = { fileName: "d.pdf", kind: "pdf" as const, bytes: 1, pages: ranges };
    expect(pageOfQuote(doc, text, "Clinically proven")).toBe(2);
    expect(pageOfQuote(doc, text, "First page")).toBe(1);
  });
});
