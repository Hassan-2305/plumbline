import type { Brand, ContentMeta, DraftFinding, MatchedFact, Rule, RuleRole } from "../types";
import { contrastRatio, normalizeHex, wcagLevels } from "./contrast";
import { hashSimilarity, nearestPaletteColour } from "./color";
import { toneConflict } from "./conflicts";
import { factEvidence, factState, noFactEvidence, ruleEvidence, todayISO } from "./evidence";
import { findPhrase, numberTokens, sameNumber, sentenceAt, sentences, wordCount } from "./text";

// Fixed, reproducible checks. They run before any AI call and never need a network.
// Exact string matching is not semantic verification — the UI says so.

const CLINICAL = [
  "clinically proven",
  "clinically tested",
  "clinically shown",
  "scientifically proven",
  "doctor recommended",
  "doctor-recommended",
  "boosts immunity",
  "boost your immunity",
  "prevents disease",
  "cures",
  "detox",
];
const GUARANTEES = ["guaranteed", "guarantee", "100% effective", "risk-free", "never fails", "always works"];
const SUPERLATIVES = ["best", "#1", "number one", "ultimate", "revolutionary", "unbeatable", "world's best", "most effective", "miracle"];
const CONVERSATIONAL = /\b(you'll|you're|we're|we've|it's|don't|can't|let's|hey|gonna|wanna|y'all)\b|!/gi;

export interface DeterministicInput {
  text: string;
  meta: ContentMeta;
  brand: Brand;
  today?: string;
}

export interface DeterministicResult {
  findings: DraftFinding[];
  matchedFacts: MatchedFact[];
  inputErrors: string[];
}

function base(
  partial: Omit<DraftFinding, "source" | "verification" | "confidence"> & Partial<DraftFinding>,
): DraftFinding {
  return { source: "deterministic", verification: "verified", confidence: null, ...partial };
}

export function runDeterministic({ text, meta, brand, today = todayISO() }: DeterministicInput): DeterministicResult {
  const findings: DraftFinding[] = [];
  const matchedFacts: MatchedFact[] = [];
  const inputErrors: string[] = [];
  const rule = (id: string) => brand.rules.find((r) => r.id === id) as Rule | undefined;
  const ev = (id: string, note?: string) => {
    const r = rule(id);
    return r ? [ruleEvidence(r, note)] : [];
  };
  // Checks cite the brand's rule for each role; a brand without that rule gets the check without a citation.
  const roleId = (role: RuleRole) => {
    const id = brand.ruleRoles?.[role];
    return id && rule(id) ? id : undefined;
  };
  const evr = (role: RuleRole, note?: string) => {
    const id = roleId(role);
    return id ? ev(id, note) : [];
  };
  const ids = (role: RuleRole) => {
    const id = roleId(role);
    return id ? [id] : [];
  };
  const covered: { start: number; end: number }[] = [];
  const overlaps = (s: number, e: number) => covered.some((c) => s < c.end && e > c.start);

  // 1. Banned terminology
  for (const b of brand.bannedTerms) {
    for (const span of findPhrase(text, b.term)) {
      covered.push(span);
      findings.push(
        base({
          juror: "Brand Guardian",
          severity: "high",
          category: "banned_term",
          title: `Banned phrase "${b.term}"`,
          offendingText: span.text,
          explanation: `"${span.text}" is explicitly banned by ${b.ruleId}.`,
          whyItMatters: "Banned phrases are objective violations; they also tend to read as sensational claims.",
          evidence: ev(b.ruleId),
          suggestedFix: b.replacement ? `Replace with "${b.replacement}".` : "Remove the banned phrase.",
          replacement: b.replacement,
          ruleIds: [b.ruleId],
        }),
      );
    }
  }

  // 2. Preferred terminology
  for (const p of brand.preferredTerms) {
    for (const avoid of p.avoid) {
      for (const span of findPhrase(text, avoid)) {
        findings.push(
          base({
            juror: "Brand Guardian",
            severity: "low",
            category: "preferred_term",
            title: `Use "${p.prefer}"`,
            offendingText: span.text,
            explanation: `${p.ruleId} prefers "${p.prefer}" over "${span.text}".`,
            evidence: ev(p.ruleId),
            suggestedFix: `Replace "${span.text}" with "${p.prefer}".`,
            replacement: matchCase(span.text, p.prefer),
            ruleIds: [p.ruleId],
          }),
        );
      }
    }
  }

  // 3. Expired / pending facts relied on, and 4. exact approved-fact matching
  const lower = text.toLowerCase();
  for (const fact of brand.facts) {
    const state = factState(fact, today);
    const exact = lower.includes(fact.statement.toLowerCase().replace(/\.$/, ""));
    const signalsHit = fact.signals.length > 0 && fact.signals.every((s) => lower.includes(s.toLowerCase()));
    if (!exact && !signalsHit) continue;
    const firstSignal = fact.signals.map((s) => lower.indexOf(s.toLowerCase())).filter((i) => i >= 0).sort((a, b) => a - b)[0];
    const sentence = sentenceAt(text, firstSignal ?? lower.indexOf(fact.statement.toLowerCase().slice(0, 10)));
    if (state === "active") {
      matchedFacts.push({ factId: fact.id, text: sentence?.text ?? fact.statement, kind: exact ? "exact" : "signal" });
      continue;
    }
    if (sentence) covered.push(sentence);
    if (state === "expired") {
      findings.push(
        base({
          juror: "Fact-Checker",
          severity: "high",
          category: "expired_fact",
          title: `Relies on expired fact ${fact.id}`,
          offendingText: sentence?.text,
          explanation: `This statement matches ${fact.id}, which expired on ${fact.expires}. Expired facts cannot support current promotional claims${roleId("expiry") ? ` (${roleId("expiry")})` : ""}. The claim is not proven false — its approved support has lapsed.`,
          whyItMatters: "Publishing a lapsed statistic presents stale data as current.",
          evidence: [factEvidence(fact, `Expired ${fact.expires}; last verified ${fact.lastVerified}.`), ...evr("expiry")],
          suggestedFix: "Remove the statement or re-verify the fact and renew its expiry date before use.",
          ruleIds: ids("expiry"),
        }),
      );
    } else {
      findings.push(
        base({
          juror: "Fact-Checker",
          severity: "medium",
          category: "unsupported_claim",
          title: `Relies on unapproved fact ${fact.id}`,
          offendingText: sentence?.text,
          explanation: `This statement matches ${fact.id}, which is still pending approval, so it cannot yet support a published claim.`,
          evidence: [factEvidence(fact, "Status: pending approval."), ...evr("numbers")],
          suggestedFix: "Wait for fact approval or remove the statement.",
          ruleIds: ids("numbers"),
        }),
      );
    }
  }

  // 5. Numerical claims not backed by an active approved fact
  const activeFacts = brand.facts.filter((f) => factState(f, today) === "active");
  const allFacts = brand.facts;
  for (const tok of numberTokens(text)) {
    if (overlaps(tok.start, tok.start + tok.raw.length)) continue;
    const supporting = activeFacts.find((f) => numberTokens(f.statement).some((t) => sameNumber(t, tok)));
    if (supporting) continue;
    const otherFact = allFacts.find((f) => numberTokens(f.statement).some((t) => sameNumber(t, tok)));
    if (otherFact) continue; // already reported as expired/pending above
    const contradicted = tok.unit
      ? activeFacts.find((f) => numberTokens(f.statement).some((t) => t.unit === tok.unit && t.unit !== "%" && t.unit !== "x"))
      : undefined;
    const sentence = sentenceAt(text, tok.start);
    if (contradicted) {
      findings.push(
        base({
          juror: "Fact-Checker",
          severity: "high",
          category: "contradicts_fact",
          title: `"${tok.raw}" may contradict ${contradicted.id}`,
          offendingText: tok.raw,
          explanation: `Approved fact ${contradicted.id} states a different ${tok.unit} value. Numerical product claims must match approved facts${roleId("numbers") ? ` (${roleId("numbers")})` : ""}.`,
          whyItMatters: "Mismatched product numbers are the most common source of corrective notices.",
          evidence: [factEvidence(contradicted), ...evr("numbers")],
          suggestedFix: `Use the approved value from ${contradicted.id}.`,
          replacement: numberTokens(contradicted.statement).find((t) => t.unit === tok.unit)?.raw,
          ruleIds: ids("numbers"),
        }),
      );
    } else {
      findings.push(
        base({
          juror: "Fact-Checker",
          severity: "medium",
          category: "unsupported_number",
          title: `Unsupported number "${tok.raw}"`,
          offendingText: sentence?.text ?? tok.raw,
          explanation: `No active approved fact contains "${tok.raw}". This does not prove the number is false — only that it is unsupported in the approved record.`,
          evidence: [noFactEvidence(`Searched ${activeFacts.length} active facts for "${tok.raw}".`), ...evr("numbers")],
          suggestedFix: "Remove the number or add an approved, verified fact that supports it.",
          ruleIds: ids("numbers"),
        }),
      );
    }
  }

  // Clinical and health claims (Risk & Compliance)
  for (const phrase of CLINICAL) {
    for (const span of findPhrase(text, phrase)) {
      const supported = activeFacts.some((f) => f.statement.toLowerCase().includes(phrase));
      if (supported) continue;
      const sentence = sentenceAt(text, span.start);
      // Clause from the phrase to the end of the sentence, without final punctuation.
      const clause = sentence ? text.slice(span.start, sentence.end).replace(/[.!?]+$/, "") : span.text;
      const benefit = brand.safeBenefit;
      findings.push(
        base({
          juror: "Risk & Compliance",
          severity: "high",
          category: "clinical_claim",
          title: "Unsupported clinical claim",
          offendingText: clause,
          explanation: `"${span.text}" implies clinical or health substantiation. No approved fact in the library supports it.`,
          whyItMatters: "The statement implies clinical substantiation that is absent from the approved record. This is a risk flag, not legal advice.",
          evidence: [noFactEvidence(`No active fact substantiates "${span.text}".`), ...evr("health")],
          suggestedFix: benefit
            ? `Replace with an approved product benefit (from ${benefit.factId}).`
            : "Replace with an approved, verifiable product benefit.",
          replacement: benefit ? matchCase(clause, benefit.phrase) : undefined,
          ruleIds: ids("health"),
        }),
      );
      covered.push({ start: span.start, end: span.start + clause.length });
    }
  }

  for (const phrase of GUARANTEES) {
    for (const span of findPhrase(text, phrase)) {
      if (overlaps(span.start, span.end)) continue;
      covered.push(span);
      findings.push(
        base({
          juror: "Risk & Compliance",
          severity: "high",
          category: "absolute_guarantee",
          title: "Absolute guarantee",
          offendingText: span.text,
          explanation: `"${span.text}" promises an outcome that no approved fact substantiates.`,
          evidence: [noFactEvidence("No approved fact supports a guaranteed outcome."), ...evr("sensational")],
          suggestedFix: "Remove the guarantee or replace it with a specific, approved benefit.",
          ruleIds: ids("sensational"),
        }),
      );
    }
  }

  for (const phrase of SUPERLATIVES) {
    for (const span of findPhrase(text, phrase)) {
      if (overlaps(span.start, span.end)) continue;
      covered.push(span);
      findings.push(
        base({
          juror: "Risk & Compliance",
          severity: "medium",
          category: "superlative",
          title: `Unsubstantiated superlative "${span.text}"`,
          offendingText: span.text,
          explanation: `"${span.text}" is a superlative with no supporting approved fact.`,
          evidence: [noFactEvidence(`No approved fact supports "${span.text}".`), ...evr("sensational")],
          suggestedFix: "Remove the superlative or cite an approved comparison.",
          ruleIds: ids("sensational"),
        }),
      );
    }
  }

  // Tone — only meaningful when the guidelines themselves are in tension.
  const conv = [...text.matchAll(CONVERSATIONAL)];
  if (conv.length >= 2) {
    const tc = toneConflict(brand.rules);
    const formalRule = brand.rules.find((r) => /\bformal\b/i.test(r.text));
    const first = conv.find((m) => m[0] !== "!") ?? conv[0];
    const sentence = sentenceAt(text, first.index ?? 0);
    if (tc) {
      findings.push(
        base({
          juror: "Brand Guardian",
          severity: "low",
          category: "guideline_conflict",
          title: `Tone sits between ${tc.ruleIds[0]} and ${tc.ruleIds[1]}`,
          offendingText: sentence?.text,
          explanation: `The copy uses ${conv.length} conversational markers (contractions, direct address, exclamation marks). That complies with ${tc.ruleIds[0]} ("${tc.termA}") but may breach ${tc.ruleIds[1]} ("${tc.termB}"). The guidelines conflict, so this is flagged for a human decision rather than auto-fixed.`,
          evidence: [...ev(tc.ruleIds[0]), ...ev(tc.ruleIds[1])],
          suggestedFix: "Decide which rule governs this content, or clarify the guideline in Guideline Intelligence.",
          ruleIds: [...tc.ruleIds],
        }),
      );
    } else if (formalRule) {
      findings.push(
        base({
          juror: "Brand Guardian",
          severity: "low",
          category: "tone",
          title: "Informal tone",
          offendingText: sentence?.text,
          explanation: `The copy uses ${conv.length} conversational markers; ${formalRule.id} asks for formal wording.`,
          evidence: ev(formalRule.id),
          suggestedFix: "Rephrase without contractions or exclamation marks.",
          ruleIds: [formalRule.id],
        }),
      );
    }
  }

  // Readability
  for (const s of sentences(text)) {
    const wc = wordCount(s.text);
    if (wc > 28) {
      findings.push(
        base({
          juror: "Accessibility Advocate",
          severity: "low",
          category: "readability",
          title: `Long sentence (${wc} words)`,
          offendingText: s.text,
          explanation: `Sentences over ~25 words are harder to follow, especially for readers with cognitive disabilities or reading in a second language.`,
          evidence: [...evr("accessibility"), { type: "measurement", excerpt: `${wc} words in one sentence (threshold 28).`, verified: true }],
          suggestedFix: "Split into two shorter sentences.",
          ruleIds: ids("accessibility"),
        }),
      );
    }
  }
  const caps = text.match(/\b[A-Z]{4,}(?:\s+[A-Z]{2,}){2,}\b/);
  if (caps) {
    findings.push(
      base({
        juror: "Accessibility Advocate",
        severity: "low",
        category: "accessibility",
        title: "Extended all-caps text",
        offendingText: caps[0],
        explanation: "Runs of all-caps words are harder to read and some assistive technologies may announce them letter by letter.",
        evidence: evr("accessibility"),
        suggestedFix: "Use sentence case and rely on weight or size for emphasis.",
        replacement: caps[0].charAt(0) + caps[0].slice(1).toLowerCase(),
        ruleIds: ids("accessibility"),
      }),
    );
  }

  // Non-descriptive link text, emoji density, lowercase hashtags
  for (const phrase of ["click here", "tap here", "read more", "learn more"]) {
    for (const span of findPhrase(text, phrase)) {
      findings.push(
        base({
          juror: "Accessibility Advocate",
          severity: "low",
          category: "accessibility",
          title: `Non-descriptive link text "${span.text}"`,
          offendingText: span.text,
          explanation: "Link text that only says where to click is meaningless when assistive technology lists links out of context.",
          evidence: evr("accessibility"),
          suggestedFix: 'Describe the destination, e.g. "See the nutrition panel".',
          ruleIds: ids("accessibility"),
        }),
      );
    }
  }
  const emoji = text.match(/\p{Extended_Pictographic}/gu) ?? [];
  if (emoji.length > 4) {
    findings.push(
      base({
        juror: "Accessibility Advocate",
        severity: "low",
        category: "accessibility",
        title: `Heavy emoji use (${emoji.length})`,
        explanation: "Each emoji is read aloud by its full name, which makes emoji-dense copy slow and confusing to listen to.",
        evidence: [...evr("accessibility"), { type: "measurement", excerpt: `${emoji.length} emoji found (threshold 4).`, verified: true }],
        suggestedFix: "Keep emoji to one or two, placed at the end of sentences.",
        ruleIds: ids("accessibility"),
      }),
    );
  }
  for (const m of text.matchAll(/#([a-z][a-z0-9]{11,})\b/g)) {
    findings.push(
      base({
        juror: "Accessibility Advocate",
        severity: "low",
        category: "accessibility",
        title: "Hashtag without capitalised words",
        offendingText: m[0],
        explanation: "Screen readers may read a long lowercase hashtag as one garbled word. Capitalising each word (CamelCase) fixes this.",
        evidence: evr("accessibility"),
        suggestedFix: "Capitalise each word, e.g. #PlantBasedProtein.",
        ruleIds: ids("accessibility"),
      }),
    );
  }

  // Uploaded image: palette and logo checks (browser measurements, not a model)
  if (meta.image) {
    const img = meta.image;
    const off = img.palette
      .filter((c) => c.share >= 0.08)
      .map((c) => ({ ...c, near: nearestPaletteColour(c.hex, brand.palette) }))
      .filter((c) => c.near.distance > 20);
    const offShare = off.reduce((n, c) => n + c.share, 0);
    if (offShare >= 0.15) {
      findings.push(
        base({
          juror: "Brand Guardian",
          severity: offShare >= 0.4 ? "medium" : "low",
          category: "image_palette",
          title: `${Math.round(offShare * 100)}% of the image uses off-palette colours`,
          explanation: `Dominant colours in ${img.fileName} are far from every approved brand colour (CIE76 ΔE > 20). This compares colours only; it does not judge what the image shows.`,
          evidence: [
            ...evr("visual"),
            ...off.map((c) => ({
              type: "measurement" as const,
              excerpt: `${c.hex} covers ${Math.round(c.share * 100)}% of the image; nearest approved colour is ${c.near.name} ${c.near.hex} (ΔE ${c.near.distance.toFixed(1)}).`,
              verified: true,
            })),
          ],
          suggestedFix: "Rework the image in the approved palette or get a documented exception.",
          ruleIds: ids("visual"),
        }),
      );
    }
    if (meta.isLogoAsset) {
      if (!brand.logo) {
        inputErrors.push("Logo comparison skipped: no reference logo has been added in Guidelines.");
      } else {
        const sim = hashSimilarity(img.dHash, brand.logo.dHash);
        const refAspect = brand.logo.width / brand.logo.height;
        const aspect = img.width / img.height;
        const aspectDiff = Math.abs(aspect - refAspect) / refAspect;
        const measure = {
          type: "measurement" as const,
          excerpt: `Perceptual-hash similarity to reference ${brand.logo.fileName}: ${Math.round(sim * 100)}%. Aspect ratio ${aspect.toFixed(2)} vs reference ${refAspect.toFixed(2)} (${(aspectDiff * 100).toFixed(1)}% difference).`,
          verified: true,
        };
        if (sim < 0.8) {
          findings.push(
            base({
              juror: "Brand Guardian",
              severity: "medium",
              category: "logo_mismatch",
              title: "Logo file does not match the approved reference",
              explanation: "The uploaded logo file looks different from the approved reference. This is a whole-image comparison: it cannot find a logo placed inside a larger image.",
              evidence: [...evr("visual"), measure],
              suggestedFix: "Use the approved logo file from the brand library.",
              ruleIds: ids("visual"),
            }),
          );
        } else if (aspectDiff > 0.03) {
          findings.push(
            base({
              juror: "Brand Guardian",
              severity: "medium",
              category: "logo_distortion",
              title: "Logo proportions differ from the reference — possibly stretched",
              explanation: `The file matches the approved logo, but its width-to-height ratio differs by ${(aspectDiff * 100).toFixed(1)}%, which suggests it was stretched or squashed.`,
              evidence: [...evr("visual"), measure],
              suggestedFix: "Resize the logo proportionally, or export it again from the approved source file.",
              ruleIds: ids("visual"),
            }),
          );
        } else {
          matchedFacts.push({
            factId: "LOGO",
            text: `${img.fileName} matches the approved reference logo (${Math.round(sim * 100)}% similarity, proportions within 3%).`,
            kind: "signal",
          });
        }
      }
    }
  }

  // 6. Alt text (only when image metadata is supplied)
  if (meta.hasImage) {
    const alt = meta.altText.trim();
    if (!alt) {
      findings.push(
        base({
          juror: "Accessibility Advocate",
          severity: "medium",
          category: "missing_alt_text",
          title: "Image has no alt text",
          explanation: "The content is marked as including an image, but no alt text was supplied. The image itself was not inspected.",
          evidence: evr("accessibility"),
          suggestedFix: "Add alt text that describes the image's purpose in one sentence.",
          ruleIds: ids("accessibility"),
        }),
      );
    } else if (
      alt.length < 15 ||
      /^(image|picture|photo) of\b/i.test(alt) ||
      /\.(png|jpe?g|webp|gif|svg)$/i.test(alt) ||
      (meta.image && alt.toLowerCase() === meta.image.fileName.toLowerCase())
    ) {
      findings.push(
        base({
          juror: "Accessibility Advocate",
          severity: "low",
          category: "weak_alt_text",
          title: "Alt text may be too thin",
          offendingText: undefined,
          explanation: `Supplied alt text "${alt}" is very short or starts with "image of", which screen readers already announce.`,
          evidence: evr("accessibility"),
          suggestedFix: "Describe what the image communicates, not that it is an image.",
          ruleIds: ids("accessibility"),
        }),
      );
    }
  }

  // Video: captions presence/quality, spoken-claim checks via captions, frame palette.
  if (meta.hasVideo || meta.video) {
    const v = meta.video;
    const cap = meta.captions;
    const mmss = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
    if (!cap) {
      findings.push(
        base({
          juror: "Accessibility Advocate",
          severity: "medium",
          category: "missing_captions",
          title: "Video has no captions",
          explanation: "No caption file was supplied. Viewers who are deaf, hard of hearing or watching without sound will miss what is said. Audio is not analysed by this tool.",
          evidence: evr("accessibility"),
          suggestedFix: "Attach a WebVTT or SRT caption file that covers all speech.",
          ruleIds: ids("accessibility"),
          location: "Video",
        }),
      );
    } else {
      const covered = cap.cues.reduce((n, c) => n + (c.end - c.start), 0);
      if (v && covered / v.duration < 0.6) {
        findings.push(
          base({
            juror: "Accessibility Advocate",
            severity: "low",
            category: "captions_quality",
            title: "Captions may not cover all speech",
            explanation: `Captions cover ${Math.round((covered / v.duration) * 100)}% of the video’s running time. That may be fine if there are silent sections, but check that all speech is captioned.`,
            evidence: [...evr("accessibility"), { type: "measurement", excerpt: `${covered.toFixed(1)}s of captions across a ${v.duration.toFixed(1)}s video.`, verified: true }],
            suggestedFix: "Caption every spoken line and meaningful sound.",
            ruleIds: ids("accessibility"),
            location: "Captions",
          }),
        );
      }
      const fast = cap.cues.filter((c) => c.text.length / (c.end - c.start) > 20);
      if (fast.length) {
        findings.push(
          base({
            juror: "Accessibility Advocate",
            severity: "low",
            category: "captions_quality",
            title: `${fast.length} caption${fast.length > 1 ? "s" : ""} too fast to read`,
            explanation: "Captions faster than about 20 characters per second are hard to read before they disappear.",
            evidence: [
              ...evr("accessibility"),
              ...fast.slice(0, 3).map((c) => ({
                type: "measurement" as const,
                excerpt: `${mmss(c.start)}: ${Math.round(c.text.length / (c.end - c.start))} characters per second — “${c.text.slice(0, 60)}${c.text.length > 60 ? "…" : ""}”`,
                verified: true,
              })),
            ],
            suggestedFix: "Lengthen the cue, split it, or shorten the wording.",
            ruleIds: ids("accessibility"),
            location: `Captions ${mmss(fast[0].start)}`,
          }),
        );
      }
      // Run the text checks on what is said, located by caption timestamp.
      const transcript = cap.cues.map((c) => c.text).join("\n");
      const inner = runDeterministic({ text: transcript, meta: { hasImage: false, altText: "", fg: "", bg: "" }, brand, today });
      for (const f of inner.findings) {
        const cue = f.offendingText ? cap.cues.find((c) => c.text.toLowerCase().includes(f.offendingText!.toLowerCase().slice(0, 30))) : undefined;
        findings.push({ ...f, title: `${f.title} (in captions)`, replacement: undefined, location: cue ? `Captions ${mmss(cue.start)}` : "Captions" });
      }
      for (const m of inner.matchedFacts) matchedFacts.push({ ...m, text: `${m.text} (captions)` });
    }
    if (v?.frames.length) {
      // Average palette across sampled frames; flag frames dominated by off-palette colour.
      const offFrames = v.frames.filter((fr) => {
        const share = fr.palette.filter((c) => c.share >= 0.08 && nearestPaletteColour(c.hex, brand.palette).distance > 20).reduce((n, c) => n + c.share, 0);
        return share >= 0.4;
      });
      if (offFrames.length) {
        const pct = Math.round((offFrames.length / v.frames.length) * 100);
        findings.push(
          base({
            juror: "Brand Guardian",
            severity: pct >= 30 ? "medium" : "low",
            category: "video_palette",
            title: `Off-palette colours in ${offFrames.length} of ${v.frames.length} sampled frames`,
            explanation: `Sampled frames were compared with the approved palette (CIE76 ΔE > 20). This samples ${v.frames.length} frames evenly; it is not a frame-by-frame review and does not judge what is shown.`,
            evidence: [
              ...evr("visual"),
              {
                type: "measurement",
                excerpt: `Frames at ${offFrames.map((f) => mmss(f.t)).join(", ")} are at least 40% off-palette.`,
                verified: true,
              },
            ],
            suggestedFix: "Grade or redesign those scenes in the approved palette, or document an exception.",
            ruleIds: ids("visual"),
            location: `Video ${mmss(offFrames[0].t)}`,
          }),
        );
      }
    }
  }

  // 7. Contrast + palette (only when both colours supplied)
  if (meta.fg.trim() || meta.bg.trim()) {
    const fg = normalizeHex(meta.fg);
    const bg = normalizeHex(meta.bg);
    if (!fg || !bg) {
      inputErrors.push("Contrast not checked: enter both colours as hex values, e.g. #1C1C1E.");
    } else {
      const ratio = contrastRatio(fg, bg);
      const lv = wcagLevels(ratio);
      if (!lv.aaNormal) {
        findings.push(
          base({
            juror: "Accessibility Advocate",
            severity: lv.aaLarge ? "medium" : "high",
            category: "contrast",
            title: `Contrast ${ratio.toFixed(2)}:1 fails WCAG AA`,
            explanation: `${fg} on ${bg} has a contrast ratio of ${ratio.toFixed(2)}:1. WCAG 2.x AA requires 4.5:1 for normal text and 3:1 for large text.${lv.aaLarge ? " It passes only for large text." : ""}`,
            evidence: [
              ...evr("accessibility"),
              { type: "measurement", excerpt: `Calculated contrast ratio ${ratio.toFixed(2)}:1 (WCAG relative luminance formula).`, verified: true },
            ],
            suggestedFix: "Use a darker foreground or lighter background from the approved palette, e.g. Charcoal #1C1C1E on White.",
            ruleIds: ids("accessibility"),
          }),
        );
      }
      const palette = brand.palette.map((p) => p.hex.toUpperCase());
      const off = [fg, bg].filter((c) => !palette.includes(c));
      if (off.length) {
        findings.push(
          base({
            juror: "Brand Guardian",
            severity: "low",
            category: "off_palette_colour",
            title: `Colour${off.length > 1 ? "s" : ""} outside approved palette`,
            explanation: `${off.join(", ")} ${off.length > 1 ? "are" : "is"} not in the approved brand palette (${brand.palette.map((p) => `${p.name} ${p.hex}`).join(", ")}).`,
            evidence: evr("visual"),
            suggestedFix: "Use an approved brand colour.",
            ruleIds: ids("visual"),
          }),
        );
      }
    }
  }

  return { findings, matchedFacts, inputErrors };
}

function matchCase(source: string, replacement: string) {
  if (source[0] && source[0] === source[0].toUpperCase() && /[a-z]/i.test(source[0])) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
