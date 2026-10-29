# Plumbline Jury

Evidence-backed brand review for marketing content.

> Every objection needs evidence. Every fix needs human consent. Every approval leaves a history.

Four jurors (Brand Guardian, Fact-Checker, Risk & Compliance, Accessibility Advocate) review drafts against a brand's rules and approved facts. Deterministic checks run first and work offline. Optional Gemini jurors add judgement. Every evidence reference is re-validated against the loaded rules and facts before it is shown. Humans accept, edit, dismiss or escalate each finding, and a simulated reviewer approves versions. Dismissal patterns feed **Guideline Intelligence**, which surfaces confusing or conflicting rules and proposes clarifications for human approval.

The demo brand **Northstar Nutrition** and all of its facts and history are **fictional**.

## The three improvements

1. **Comments and a three-role workflow.** Creators, managers and authorised reviewers each have enforced permissions (see the matrix in Settings). Comment threads sit on each piece of content and on each finding, and @mentions appear in the mentioned role's "Needs your attention" list. Managers approve low-risk work; only a reviewer can override high-risk or escalated findings, with a recorded reason.
2. **Confidential mode with an AI disclosure ledger.** Confidential items never leave the browser. Everything else is redacted before any AI call: emails, phones, card numbers, secrets and brand-defined confidential terms. Users can preview exactly what will be sent, and every external request is logged and exportable.
3. **Test this change.** Before a guideline change is approved, every version of every reviewed item is replayed under the old and new rules and scored against real human decisions: noise removed, real issues still caught, real issues lost, and approved content that would now fail.

More detail: [Architecture](docs/ARCHITECTURE.md) · [Responsible design](docs/RESPONSIBLE_DESIGN.md) · [Testing](docs/TESTING.md) · [Contributions](docs/CONTRIBUTIONS.md)

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Other commands: `npm test` (42 unit tests), `npm run typecheck`, `npm run lint`, `npm run build`, `npm start`, `npm run demo-assets`.

No database, login or API key is required. State lives in browser `localStorage` (key `plumbline-jury:v1`). Use **Reset Demo** (Overview or Settings) to restore the original state.

## Live AI (optional)

Create `.env.local` (see `.env.example`):

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | for live AI | Google AI Studio key. Server-side only. |
| `GEMINI_MODEL` | no | Defaults to `gemini-2.5-flash`. Use any `generateContent` model your key can access. |

`/settings` and `GET /api/status` report whether the key is set and whether the model exists for the key (checked with a metadata call, which uses no generation quota). Free-tier quotas and model availability change, so check this after deploying.

All four juror perspectives go in **one** structured Gemini request to save quota. Failures (missing key, 401/403, 404 model, 429 rate limit, 5xx, timeout, malformed JSON) are shown as failures. Deterministic findings still appear, and no AI result is ever invented.

When live AI is used, the draft text, its metadata and the brand's rules and facts are sent to Google's Gemini API. Don't submit confidential content.

## Deploy (Vercel free tier)

1. Push this folder to a GitHub repository.
2. On vercel.com, choose **Add New → Project** and import the repository. The framework is detected as Next.js; keep the defaults.
3. Optional: add `GEMINI_API_KEY` (and `GEMINI_MODEL`) under **Settings → Environment Variables**, then redeploy.
4. Open `/settings` on the deployed URL to confirm the AI status.

Alternatively, run `npx vercel` from this folder and follow the prompts.

## What works

- **First run**: the demo brand, 10 rules, 6 facts (active, expired and pending) and 5 labelled seeded review items load automatically. **Try Demo** opens a reviewed example in one click.
- **Deterministic checks** (`src/lib/engine/deterministic.ts`): banned terms, preferred terms, expired or pending facts, exact and key-figure fact matching, numerical claims (unsupported, or contradicting an approved fact), clinical-claim phrases, absolute guarantees, superlatives, tone vs the conflicting tone rules, long sentences, all-caps runs, missing or weak alt text, real WCAG contrast ratio and off-palette colours.
- **AI jurors** (`src/lib/ai/gemini.ts`): a structured JSON schema and prompt-injection framing (content is wrapped as untrusted data). Server-side validation drops findings that quote text not present in the draft, marks findings citing non-existent rule or fact IDs as **Unverified**, and replaces every excerpt with the source record text.
- **Coordinator** (`src/lib/engine/coordinator.ts`): merges duplicates, marks corroboration, and keeps disagreements in severity with a note.
- **Findings UI**: grouped by source (Deterministic / AI-assisted / Seeded demo results) and then by juror. Each finding shows evidence panels, explanation, suggested fix, a before/after preview, model-reported confidence (labelled as not calibrated) and decision history.
- **Fixes**: Accept (minimal local replacement), Edit, Dismiss (reason required), Escalate and Reopen. Each applied fix creates a new version.
- **Approval workflow**: Draft → review → Submit → Under Review → Approve or Request Changes. Unresolved high-risk findings block approval unless the reviewer overrides them with a recorded reason. Editing approved text returns it to Draft.
- **Version history**: word-level diff against the original or the previous version, plus lists of accepted fixes and dismissed findings with reasons.
- **Guideline Intelligence**: a lexicon conflict detector finds R-001 ↔ R-009. The app shows both rules, the reason they conflict, example context, review statistics and an editable proposed clarification. Approving it versions the rule and keeps the old text. You can also paste guideline text to analyse it for conflicts.
- **Insights**: review runs, open and high-risk findings, most flagged rules, most dismissed rules, dismissal reasons and potentially confusing guidelines with example notes and suggested improvements. Seeded history can be toggled off.
- **Guideline management**: anyone can propose a rule edit, a new rule, or a banned or preferred term with a reason. Only the reviewer role can approve or reject, and the queue shows a word diff for each edit. Approved edits version the rule and keep the old text. New facts start as pending and must be approved before they can support claims; reviewers can re-verify a fact and set a new expiry. Every applied change goes into the brand change log.
- **AI guideline analysis** (`src/lib/ai/conflicts.ts`, `POST /api/guidelines/analyze`): Gemini looks for conflicts across the current rules plus any pasted text. Results citing rule IDs that don't exist are discarded. A conflict between existing rules can be added to Guideline Intelligence, labelled as an AI proposal.
- **Image checks** (`src/lib/image/analyze.ts`, browser-only): upload or drop PNG, JPEG, WebP, GIF or SVG files up to 5 MB, or use the bundled demo images (approved logo, stretched logo, off-brand banner). The app reads the file metadata, extracts the dominant colours and compares them with the palette (CIE76 ΔE), and computes a 64-bit perceptual hash (dHash). It flags off-palette images, logo files that don't match the reference (whole-file comparison) and logo files whose proportions differ by more than 3% from the reference (possible stretching). Alt text that is just a file name is flagged. Images are never sent to the AI.
- **Document review**: import a PDF, Word (.docx), TXT or Markdown file as the content to review (or use the sample sell sheet). Text is extracted in the browser, and findings in multi-page PDFs show their page. Documents over 8,000 characters get rule-based checks only.
- **Comments, roles and permissions**: see "The three improvements" above.
- **Confidential mode and AI ledger**: see "The three improvements" above.
- **Usability feedback**: "Give feedback" in the sidebar records task, completion and ease (1–5) locally; export it from Settings. The test script is in docs/TESTING.md.
- **Multiple brands**: create a brand from the sidebar switcher or Settings, starting with starter rules, a copy of the current brand's rules, or nothing. Pages, insights, conflicts and new reviews are scoped to the brand in view. Each brand maps its rules to the built-in checks ("check categories"), so findings cite that brand's own rule IDs; a brand without a matching rule still gets the check, just without a citation. Brands you create can be deleted.
- **Brand-book import** (`src/lib/import/extract.ts`, `src/components/guidelines/ImportPanel.tsx`): PDF, TXT or Markdown, read in the browser with pdf.js. Rule-like sentences, banned phrases ("Never use the phrase …"), preferred terms ("Use … instead of …") and named hex colours are detected by pattern. AI suggestions are optional (`POST /api/guidelines/extract`), and any AI rule whose quote isn't found verbatim in the document is discarded. Everything becomes a proposal for a reviewer. Approving rules re-runs conflict detection, so the sample book's "playful and conversational" vs "strictly formal" clash is caught automatically.
- **Video review** (`src/lib/video/analyze.ts`, `src/components/review/VideoPanel.tsx`, browser-only): MP4, WebM, Ogg or MOV up to 100 MB. The app reads the metadata and samples up to 12 evenly spaced frames, each compared with the palette (frames that are 40% or more off-palette are flagged with timestamps). WebVTT and SRT captions are parsed and checked for presence, runtime coverage and reading speed (above 20 characters per second). The caption text also goes through every text check, so spoken claims such as "miracle formula" or "clinically proven" are flagged with their caption timestamp.
- **Extra accessibility checks**: non-descriptive link text ("click here", "read more"), heavy emoji use and long all-lowercase hashtags.
- **Resilience**: localStorage saved by the earlier version of this app is migrated automatically. corrupted or unavailable localStorage restores the demo and shows a notice; empty content, oversized content and invalid hex colours are handled; the layout works on mobile.

## Design and walkthrough

- **Theme, warm and calm:** a cream canvas with white cards, warm stone neutrals and one orange accent (`accent-600`) for primary actions and selection; amber marks warnings and red is kept for genuine risk. Headings use Instrument Serif, body text Geist (Geist Mono for IDs). Home leads with what needs attention, a review queue, approval status, top issues and a get-started checklist computed from real workspace state. Motion is limited to short transitions. Tokens live in `src/app/globals.css`; primitives in `src/components/ui.tsx`.
- **Navigation:** a compact sidebar grouped into Workspace (Home, Content, Reviews, Approvals), Brand (Guidelines, Brand assets, Approved facts), Intelligence (Insights, Activity) and Workspace settings (Team & permissions, Integrations, Settings). It also has a workspace switcher (one workspace per brand), Ctrl K search across content, rules, facts and pages, and a profile menu for switching the simulated user. On phones it becomes a slide-in drawer.
- **Home:** a workspace, not a dashboard. It shows Continue working, Needs your review (approvals, mentions, changes requested and, for reviewers, guideline decisions), Your content by lifecycle state, and Recent activity.
- **Review workspace (`/content/[id]`):** a split view. On the left, the content renders as it will appear (a social post card, an email with its subject line, or a page or document) with findings underlined in place; Edit and Versions views sit beside it. On the right, the review panel shows a plain verdict, findings grouped by juror with evidence and fixes, discussion and history. Selecting a finding highlights its text, and selecting the text opens its finding. Run review, Submit, Request changes and Approve all sit in one decision bar, with the lifecycle (Draft → In review → Changes requested → Ready for approval → Approved), the creator and the assigned reviewer.
- **Guided walkthrough** (`src/components/tour/*`): a 12-step spotlight tour opens automatically on a first visit to any page. It walks through the workflow (Create → Review → Decide → Approve → Improve), and a strip on every card shows which stage you are on. Restart it with "Product tour" in the sidebar, or share a link ending in `?tour` (for example `/?tour`) to open it every time. It is accessible: a modal dialog labelled by its title, focus moved to the primary button, focus kept inside the card, ←/→/Esc keys and a polite live region. It respects reduced-motion settings and shows as a bottom sheet on phones. Steps target `data-tour` attributes, so the copy lives in `steps.ts`.

## Known limitations

- localStorage is prototype persistence. It is not secure, not multi-user and not a tamper-proof audit trail.
- Roles are simulated (Creator, Manager, Reviewer) with no authentication; permissions are enforced in client-side state only. Approval applies only inside this app and cannot stop publication elsewhere.
- Exact and lexical matching is not semantic verification. A paraphrase may be valid, and an exact match may still mislead in context.
- The deterministic conflict check only catches opposing terms. AI conflict analysis needs a Gemini key.
- Image checks are measurements, not understanding. Nothing identifies what an image depicts, finds a logo inside a larger image, or checks logo clear space. Logo comparison works on whole logo files only.
- Video checks are limited to sampled frames and captions. Audio is not transcribed, there's no frame-by-frame or flashing-content analysis, and on-screen text is not read.
- Scanned (image-only) PDFs can't be imported because there's no OCR. Pattern extraction can miss rules phrased unusually; AI suggestions help when a key is configured.
- Brands live in one browser's storage; there's no sharing between users.
- AI findings are assessments, not legal advice. Confidence is self-reported by the model.

## Testing notes

- `scripts/mock-gemini.mjs` is a local mock of the Gemini API. Start it with `node scripts/mock-gemini.mjs`, then run the app with `GEMINI_API_KEY=test GEMINI_API_BASE=http://localhost:3999`. Switch modes with `curl -X POST localhost:3999/mode -d ok|fakeids|badjson|ratelimit|down`. The mock answers both the review and the guideline-analysis endpoints.
- Brand-book path to rehearse: brand switcher → New brand… → "Empty" → Rules tab → Import brand book → Use sample brand book → Propose → switch to Reviewer → Conflicts & proposals → approve. Expect 12 rules and a detected R-001 ↔ R-002 tone conflict. Import again to add the banned and preferred terms.
- Video path to rehearse: Northstar → new review → Media & accessibility → Content includes a video → Use demo video + captions → Run Jury Review. Expect findings for off-palette frames at 00:04 and 00:05, "miracle formula" and a clinical claim in the captions at 00:03, and fast captions.
- Demo assets (`public/demo/aurora-brand-book.pdf`, `northstar-promo.mp4`, `northstar-promo.vtt`) are fictional and generated by `node scripts/make-demo-assets.mjs`. The video step needs ffmpeg. `public/pdf.worker.min.mjs` is copied from `pdfjs-dist`; copy it again after upgrading that package.
- Image path to rehearse: Guidelines → switch to Reviewer → Use demo logo. Then in a new review, tick "Content includes an image" → Demo: Stretched logo → Run Jury Review. Expect a "possibly stretched" finding with the hash similarity and the aspect ratios.
- Demo path to rehearse: Home → Open a reviewed sample → select an underlined phrase → Accept fix on `miracle formula` → Dismiss `50%` (Evidence insufficient) → Re-run review → Submit for approval → profile menu → Marcus (Manager): Approve is blocked → Dana (Reviewer): Approve with an override reason → Guidelines → Run test on the R-001/R-009 clarification → Approve revision → Insights.

## Team module map

| Owner | Area | Files |
|---|---|---|
| Rahil | Backend, AI orchestration, deterministic checks, evidence validation | `src/lib/engine/*`, `src/lib/ai/*`, `src/app/api/*`, `src/lib/import/*` |
| Hassan | Review workspace, findings, fixes, versions, approval, brands, tour | `src/components/review/*`, `src/components/brands/*`, `src/components/tour/*`, `src/app/review/*`, `src/lib/store.ts` |
| Niveth | Images, video, accessibility, contrast, guideline intelligence, insights | `src/lib/image/*`, `src/lib/video/*`, `src/lib/engine/color.ts`, `src/lib/engine/contrast.ts`, `src/lib/engine/conflicts.ts`, `src/lib/insights.ts`, `src/components/guidelines/*`, `src/app/guidelines`, `src/app/insights` |
| Nithin | Demo brand, seed data, demo images, scenarios, QA, README, video | `src/lib/seed/*`, `public/demo/*`, `README.md`, `scripts/*` |

Shared contracts live in `src/lib/types.ts`. Tell the team before changing them.
# plumbline
