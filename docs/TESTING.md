# Testing and reliability

## Automated tests

```bash
npm test          # Vitest unit tests
npm run typecheck # TypeScript
npm run lint      # ESLint
npm run build     # production build
```

CI (`.github/workflows/ci.yml`) runs all four on every push.

| Suite | What it proves |
|---|---|
| `tests/engine.test.ts` | WCAG contrast matches reference ratios. Demo scenarios A/B/C produce the expected findings, evidence IDs and minimal fixes. "Unsupported" isn't called "false". The R-001/R-009 conflict is raised, not resolved. Rule roles cite the right brand's rules. Captions are checked with timestamps. Text, diff and colour helpers work. The coordinator merges corroboration and keeps disagreements. |
| `tests/trust.test.ts` | Redaction masks emails, phones, cards, secrets and confidential terms, restores them, and leaves ordinary marketing numbers alone. AI output validation drops quotes not in the content, marks invented IDs **Unverified**, clamps confidence and rejects unknown jurors. Evidence excerpts are replaced with real rule text. The permission matrix is correct. |
| `tests/features.test.ts` | **Test this change**: the R-009 clarification removes only dismissed noise and is "safe"; weakening terminology loses accepted issues and is "risky"; a new banned term breaks approved content; no change means no impact. Caption parsing (VTT and SRT). Brand-book rule, term and colour extraction. Document page mapping. |

## Failure-mode checks (run against a local Gemini mock)

`scripts/mock-gemini.mjs` imitates the Gemini API. Start the app with `GEMINI_API_KEY=test GEMINI_API_BASE=http://localhost:3999` and switch modes with `curl -X POST localhost:3999/mode -d <mode>`.

| Mode | Expected and verified behaviour |
|---|---|
| `ok` | AI findings appear as AI-assisted; a quote that isn't in the draft is dropped; an invented fact ID shows as Unverified; a matching AI finding merges into the deterministic one as corroboration |
| `fakeids` | All AI evidence is marked Unverified |
| `badjson` | "Malformed JSON" error; no AI findings recorded; rule-based findings shown |
| `ratelimit` | HTTP 429 → "rate limit" message; nothing fabricated |
| `down` | HTTP 503 → "unavailable" message |
| (no key) | `/api/status` reports not configured; the AI toggle is disabled; the rule-based review still works |

Rule extraction and conflict analysis are covered by the same mock: invented rule IDs and quotes not found in the document are discarded.

## Manual end-to-end checks (browser)

- First visit: the demo loads, the guided tour opens, all 11 tour steps find their targets on desktop and mobile.
- Try Demo → click a highlight → evidence → Accept Fix → Dismiss with reason → re-run → submit (creator) → approve (manager or reviewer).
- A manager can't approve with open high-risk findings; a reviewer can override with a reason, and the override is recorded.
- Comments with @mentions appear under "Needs your attention" for the mentioned role.
- A confidential item sends nothing to AI. Redaction preview and ledger entries match.
- Document review: the sample sell sheet (PDF) produces findings labelled with their page. Word files import.
- A brand-book PDF imports into a new empty brand; approving the proposals creates the rules and detects the conflict automatically.
- Video: frames are sampled, off-palette frames flagged, captions checked for spoken claims.
- Corrupted localStorage restores the demo with a notice. Data from older schemas is migrated.
- No horizontal overflow at 375 px on any page.

## Reliability fixes made during development

| Problem found | Fix |
|---|---|
| Next 16 Cache Components broke the API routes and the localStorage pages | Disabled Cache Components; routes marked dynamic |
| Built-in checks cited Northstar rule IDs for every brand | Per-brand rule roles; checks cite only rules that exist |
| Banned phrases with curly apostrophes (world’s) missed straight ones | Apostrophe- and quote-insensitive phrase matching |
| Brand-book extraction missed "Our voice is …" and quoted terms with apostrophes | Broader directive patterns; quote delimiters limited to double quotes |
| The tour spotlight shifted the page when targeting the sticky sidebar | Scroll only when the target is off-screen; side placement; bottom sheet on phones |
| Re-running a review deleted earlier AI/seeded judgements | Open AI findings are kept when no new AI output arrives |
| Fix-accept could edit the copy for findings located in captions | Media-located findings can't edit the copy |
| Overview overflowed on 375 px screens | Grid children allowed to shrink |
| Impact replay ignored earlier versions | Replays every version of every item |

## User testing

Real feedback can be collected in the app ("Give feedback" in the sidebar) and exported from Settings. **No user-testing results are included here, because none have been collected yet.** Run this script with 3–5 people and record the results below.

### Script (about 10 minutes per person, no help given)

1. "You've been sent this product link. Find out whether this social post is safe to publish." (Expect: Try Demo, then read the verdict.)
2. "Why is the clinical claim a problem? Show me the rule it breaks." (Evidence panel.)
3. "Fix the banned phrase. Dismiss the 50% finding with a reason." (Accept Fix, Dismiss.)
4. "Ask the manager a question about one finding." (Comment with @manager.)
5. "Submit it, then approve it as the manager." (Approval tab, role switch.)
6. "Two rules seem to contradict each other. Find them and check whether fixing the wording is safe." (Guidelines → Run test.)
7. "Make sure the email draft never sends our codename to AI." (Confidential mode, or confidential terms plus the preview.)

After each task: "Give feedback" (ease 1–5, completed yes/partly/no).

### Results (fill in from real sessions)

| Tester (role, no names) | Tasks completed | Average ease | Main issue observed | Change made |
|---|---|---|---|---|
| | | | | |
