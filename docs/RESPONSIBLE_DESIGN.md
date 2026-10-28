# Privacy, security, accessibility and responsible design

## Human control

- The jury suggests; people decide. No fix is applied without a click, and fixes are minimal local replacements, never rewrites.
- Dismissals need a reason. Escalations go to an authorised reviewer.
- Approval follows an enforced permission matrix: creators submit, managers approve only low-risk work, and only an authorised reviewer can override high-risk or escalated findings. Overrides need a written reason that is kept in the history.
- Guidelines never change silently. Every rule, term, fact or asset change is a proposal that a reviewer approves, earlier wording is versioned, and **Test this change** shows the impact before approval.
- Dismissals are treated as signals, not proof that the jury was wrong.

## Explainability and reliability

- Every finding names its juror, severity, cited rule or approved fact (with the exact source text), explanation and suggested fix.
- Evidence is resolved against the loaded brand library on the server. Invented IDs are marked **Unverified**, and AI quotes not found in the content are dropped.
- "Unsupported" is never presented as "false". When no approved fact exists, the finding says so.
- Rule-based, AI-assisted and seeded demo results are labelled differently. Model confidence is shown as self-reported, not calibrated.
- AI failures (missing key, rate limit, outage, malformed output) are shown as failures; the rule-based findings still appear.

## Protecting confidential material

| Material | Where it goes |
|---|---|
| Images, video frames, captions, imported documents | Analysed in the browser only. Never uploaded. |
| Content marked **Confidential** | Never leaves the browser; AI review is blocked. |
| Other content, when live AI is on | Redacted in the browser first: emails, phone numbers, card-like numbers, secrets/API keys and brand-defined confidential terms (e.g. "Project Polaris") are replaced with placeholders. Users can preview exactly what will be sent. |
| Brand rules and approved facts | Sent with AI requests so findings can cite them. |
| API key | Server environment only; never sent to the browser. |

Every external AI request is recorded in the **AI disclosure ledger** (Settings): purpose, service, model, who sent it, when, character count, redaction counts, outcome and the exact redacted text sent (truncated for storage). The ledger can be exported.

Free-tier AI terms may allow the provider to use submitted data, and the app says so.

## Security notes and limits

- No authentication. Roles are simulated for demonstration, and the permission matrix is enforced in client-side state only. A production deployment needs real identity, server-side authorisation and server-side storage.
- localStorage is prototype persistence: not encrypted, not shared, not tamper-proof.
- Content sent to AI is treated as untrusted (prompt-injection framing plus output validation), but no model call is assumed to be fully safe.
- AI findings are assessments, not legal advice.

## Accessibility of the product

- Keyboard reachable throughout, visible focus rings, a skip link, ARIA tabs, radio groups, dialogs and live regions.
- The guided tour is an accessible dialog: focus is managed and trapped, ←/→/Esc work, steps are announced, it respects reduced-motion settings, and it becomes a bottom sheet on phones.
- Severity is never shown by colour alone (labels and text accompany colour).
- Responsive layouts with no horizontal scrolling at 375 px.

## Accessibility of reviewed content

The checks cover alt text (missing, too thin, or just a file name), WCAG contrast from supplied colours (a real calculation), long sentences, all-caps runs, non-descriptive link text, emoji density, lowercase hashtags, missing captions, caption coverage and caption reading speed. The app doesn't claim to inspect what an image shows, test screen readers or detect flashing content.

## Fictional data

All brands, facts, review history and media are fictional and labelled. No real-world substantiation, clinical evidence or regulatory approval is implied.
