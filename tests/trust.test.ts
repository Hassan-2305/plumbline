import { describe, expect, it } from "vitest";
import { redact, restore } from "@/lib/privacy/redact";
import { validateAiFindings } from "@/lib/ai/review";
import { validateEvidence } from "@/lib/engine/evidence";
import { can } from "@/lib/roles";
import { NORTHSTAR } from "@/lib/seed/brand";
import type { AiReviewRequest } from "@/lib/types";

describe("redaction before AI", () => {
  it("masks emails, phones, cards, secrets and confidential terms", () => {
    const r = redact(
      "Email press@northstar.example or call +44 20 7946 0958. Card 4111 1111 1111 1111. Key sk_live_abcdef1234567890ABCDEF. Project Polaris launches soon.",
      ["Project Polaris"],
    );
    expect(r.text).not.toMatch(/press@|7946|4111|sk_live|Polaris/);
    expect(r.counts.map((c) => c.kind).sort()).toEqual(["card", "confidential term", "email", "phone", "secret"]);
  });
  it("uses one placeholder per distinct value and restores originals", () => {
    const r = redact("a@b.co and again a@b.co", []);
    expect(r.text).toBe("[EMAIL-1] and again [EMAIL-1]");
    expect(restore(r.text, r.redactions)).toBe("a@b.co and again a@b.co");
  });
  it("leaves ordinary marketing numbers alone", () => {
    const r = redact("24g of protein, 78% preferred it, rated 4.8 by 2,000 customers.", []);
    expect(r.counts).toEqual([]);
  });
});

const req: AiReviewRequest = {
  text: "Clinically proven to double your results.",
  contentType: "Social post",
  meta: { hasImage: false, altText: "", fg: "", bg: "" },
  brand: NORTHSTAR,
};

describe("AI output validation", () => {
  it("drops findings that quote text not in the submitted content", () => {
    const { findings, dropped } = validateAiFindings(
      [{ juror: "Brand Guardian", severity: "low", category: "tone", title: "x", offending_text: "not in the draft", explanation: "e", evidence: [], suggested_fix: "f", confidence: 0.5 }],
      req,
    );
    expect(findings).toHaveLength(0);
    expect(dropped).toBe(1);
  });
  it("marks findings citing non-existent IDs as unverified and never shows model excerpts", () => {
    const { findings } = validateAiFindings(
      [
        {
          juror: "Fact-Checker",
          severity: "high",
          category: "unsupported_claim",
          title: "x",
          offending_text: "Clinically proven",
          explanation: "e",
          evidence: [{ type: "approved_fact", id: "F-999" }],
          suggested_fix: "f",
          confidence: 3,
        },
      ],
      req,
    );
    expect(findings[0].verification).toBe("unverified");
    expect(findings[0].evidence[0].verified).toBe(false);
    expect(findings[0].confidence).toBe(1);
  });
  it("rejects unknown jurors and severities", () => {
    const { dropped } = validateAiFindings([{ juror: "Hacker", severity: "critical", title: "x", explanation: "y" }], req);
    expect(dropped).toBe(1);
  });
  it("replaces excerpts with the real rule text", () => {
    const [e] = validateEvidence([{ type: "guideline", id: "R-005", excerpt: "made-up quote", verified: false }], NORTHSTAR);
    expect(e.excerpt).toBe(NORTHSTAR.rules.find((r) => r.id === "R-005")!.text);
    expect(e.verified).toBe(true);
  });
});

describe("role permissions", () => {
  it("lets only reviewers override or change guidelines", () => {
    expect(can("reviewer", "content.override")).toBe(true);
    expect(can("manager", "content.override")).toBe(false);
    expect(can("creator", "content.approve")).toBe(false);
    expect(can("manager", "content.approve")).toBe(true);
    expect(can("creator", "guideline.approve")).toBe(false);
    expect(can("creator", "guideline.propose")).toBe(true);
  });
});
