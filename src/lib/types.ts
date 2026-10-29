// Shared interfaces for Plumbline Jury. Every module (engine, UI, insights, seed)
// imports from here — change carefully and tell the team.

export type Juror =
  | "Brand Guardian"
  | "Fact-Checker"
  | "Risk & Compliance"
  | "Accessibility Advocate";

export const JURORS: Juror[] = [
  "Brand Guardian",
  "Fact-Checker",
  "Risk & Compliance",
  "Accessibility Advocate",
];

export type Severity = "high" | "medium" | "low";

export type FindingCategory =
  | "banned_term"
  | "preferred_term"
  | "tone"
  | "messaging"
  | "guideline_conflict"
  | "unsupported_claim"
  | "unsupported_number"
  | "contradicts_fact"
  | "expired_fact"
  | "clinical_claim"
  | "absolute_guarantee"
  | "superlative"
  | "misleading_claim"
  | "missing_alt_text"
  | "weak_alt_text"
  | "contrast"
  | "off_palette_colour"
  | "readability"
  | "accessibility"
  | "image_palette"
  | "logo_mismatch"
  | "logo_distortion"
  | "missing_captions"
  | "captions_quality"
  | "video_palette";

/** Where a finding came from. Displayed separately in the UI. */
export type FindingSource = "deterministic" | "ai" | "seeded";

/** verified = every evidence ref resolved against loaded rules/facts. */
export type Verification = "verified" | "unverified";

export type FindingStatus =
  | "open"
  | "accepted"
  | "edited"
  | "dismissed"
  | "escalated";

export type DismissReason =
  | "False positive"
  | "Rule unclear"
  | "Approved exception"
  | "Evidence insufficient"
  | "Other";

export const DISMISS_REASONS: DismissReason[] = [
  "False positive",
  "Rule unclear",
  "Approved exception",
  "Evidence insufficient",
  "Other",
];

export interface EvidenceRef {
  /** no_fact = explicit statement that no approved supporting fact was found */
  type: "guideline" | "approved_fact" | "no_fact" | "measurement";
  id?: string;
  /** Always copied from the source record, never from model output. */
  excerpt: string;
  verified: boolean;
  note?: string;
}

export interface Decision {
  action:
    | "created"
    | "accepted"
    | "edited"
    | "dismissed"
    | "escalated"
    | "reopened";
  at: string;
  by: string;
  reason?: DismissReason;
  note?: string;
  before?: string;
  after?: string;
}

export interface Finding {
  id: string;
  juror: Juror;
  severity: Severity;
  category: FindingCategory;
  title: string;
  offendingText?: string;
  explanation: string;
  whyItMatters?: string;
  evidence: EvidenceRef[];
  /** Human-readable correction advice. */
  suggestedFix: string;
  /** Minimal replacement for offendingText; absent when no local fix is safe. */
  replacement?: string;
  /** Model self-reported; not a calibrated probability. null for deterministic. */
  confidence: number | null;
  status: FindingStatus;
  source: FindingSource;
  verification: Verification;
  ruleIds: string[];
  history: Decision[];
  /** Set by the coordinator when jurors disagree or corroborate. */
  coordinatorNote?: string;
  /** Where the issue is when it isn't in the main copy, e.g. "Captions 00:03". */
  location?: string;
}

export interface Rule {
  id: string;
  title: string;
  text: string;
  version: number;
  history: { version: number; text: string; changedAt: string; reason: string }[];
}

/** Built-in checks look up the brand's rule for each role. */
export type RuleRole = "sensational" | "health" | "numbers" | "expiry" | "accessibility" | "visual";

export const RULE_ROLES: { role: RuleRole; label: string }[] = [
  { role: "sensational", label: "Superlatives & guarantees" },
  { role: "health", label: "Health & clinical claims" },
  { role: "numbers", label: "Numerical claims" },
  { role: "expiry", label: "Expired facts" },
  { role: "accessibility", label: "Accessibility" },
  { role: "visual", label: "Logos & colours" },
];

export type FactStatus = "approved" | "pending";

export interface ApprovedFact {
  id: string;
  statement: string;
  source: string;
  lastVerified: string; // ISO date
  expires?: string; // ISO date
  status: FactStatus;
  /** Tokens that indicate content relies on this fact (numbers, key phrases). */
  signals: string[];
}

export interface TermRule {
  term: string;
  ruleId: string;
  replacement?: string;
}

export interface PreferredTerm {
  avoid: string[];
  prefer: string;
  ruleId: string;
}

export interface Brand {
  id: string;
  name: string;
  description: string;
  /** Demo brands are fictional and labelled as such. */
  fictional: boolean;
  /** Which rule each built-in check cites. */
  ruleRoles?: Partial<Record<RuleRole, string>>;
  rules: Rule[];
  facts: ApprovedFact[];
  bannedTerms: TermRule[];
  preferredTerms: PreferredTerm[];
  palette: { name: string; hex: string }[];
  /** Approved benefit phrase used as a minimal replacement for unsupported claims. */
  safeBenefit?: { factId: string; phrase: string };
  /** Words that must never be sent to an external AI service (codenames, unreleased products). */
  sensitiveTerms?: string[];
  /** Approved reference logo, analysed in the browser. */
  logo?: ImageAnalysis;
  /** Proposed guideline changes awaiting a reviewer decision. */
  changes: GuidelineChange[];
  /** Every applied change to rules, facts, terms or assets. */
  changelog: AuditEvent[];
}

export type ChangeStatus = "pending" | "approved" | "rejected";

export interface GuidelineChange {
  id: string;
  kind: "rule_edit" | "rule_add" | "banned_add" | "preferred_add";
  ruleId?: string;
  title?: string;
  text?: string;
  term?: string;
  replacement?: string;
  avoid?: string[];
  /** For new rules: which built-in check should cite this rule. */
  role?: RuleRole;
  /** Where a rule came from, e.g. an imported PDF page. */
  source?: string;
  reason: string;
  proposedBy: string;
  proposedAt: string;
  status: ChangeStatus;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  /** Result of "Test this change" against review history. */
  impact?: ImpactSummary;
}

/** Result of in-browser image inspection. Nothing here comes from a model. */
export interface ImageAnalysis {
  fileName: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  /** Downscaled preview (data URL) — the original file is not stored. */
  thumb: string;
  /** Dominant colours with their share of opaque pixels. */
  palette: { hex: string; share: number }[];
  /** 64-bit difference hash (16 hex chars) for basic similarity. */
  dHash: string;
  analyzedAt: string;
}

export type ContentType =
  | "Social post"
  | "Marketing email"
  | "Web copy"
  | "Ad copy"
  | "Press release"
  | "Document";

export const CONTENT_TYPES: ContentType[] = [
  "Social post",
  "Marketing email",
  "Web copy",
  "Ad copy",
  "Press release",
  "Document",
];

/** Draft → In Review → Changes Requested → Ready for Approval → Approved */
export type ContentStatus = "draft" | "in_review" | "changes_requested" | "ready_for_approval" | "approved";

export const LIFECYCLE: ContentStatus[] = ["draft", "in_review", "changes_requested", "ready_for_approval", "approved"];

export interface Version {
  id: string;
  number: number;
  text: string;
  createdAt: string;
  label: string;
}

export interface ReviewRun {
  id: string;
  at: string;
  mode: "deterministic" | "deterministic+ai" | "seeded";
  /** "skipped": the AI was slow or unavailable, so the review finished with rule-based checks. */
  aiStatus: "not_requested" | "ok" | "failed" | "skipped" | "not_configured" | "seeded" | "confidential";
  aiError?: string;
  model?: string;
  versionNumber: number;
  findingCount: number;
  /** Checks that could not run, e.g. invalid colour input. */
  notices?: string[];
}

export interface ApprovalRecord {
  decision: "approved" | "changes_requested";
  at: string;
  reviewer: string;
  note?: string;
  versionNumber: number;
  overriddenFindingIds: string[];
  overrideReason?: string;
}

export interface AuditEvent {
  at: string;
  by: string;
  text: string;
}

export interface ContentMeta {
  hasImage: boolean;
  altText: string;
  fg: string;
  bg: string;
  /** Uploaded image inspected in the browser. */
  image?: ImageAnalysis;
  /** The uploaded image is a logo file to compare with the brand reference. */
  isLogoAsset?: boolean;
  /** Content includes a video (checked even if no file is attached). */
  hasVideo?: boolean;
  video?: VideoAnalysis;
  captions?: CaptionTrack;
  document?: DocumentMeta;
}

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

export interface CaptionTrack {
  fileName: string;
  cues: CaptionCue[];
}

/** Frames sampled in the browser. Audio is never analysed. */
export interface VideoAnalysis {
  fileName: string;
  mimeType: string;
  bytes: number;
  duration: number;
  width: number;
  height: number;
  frames: { t: number; thumb: string; palette: { hex: string; share: number }[] }[];
  analyzedAt: string;
}

export type Role = "creator" | "manager" | "reviewer";

export interface FeedbackEntry {
  id: string;
  at: string;
  role: Role;
  page: string;
  task: string;
  ease: 1 | 2 | 3 | 4 | 5;
  completed: "yes" | "partly" | "no";
  comment: string;
}

export interface Comment {
  id: string;
  at: string;
  by: string;
  role: Role;
  text: string;
  /** Thread attached to a specific finding; absent for item-level discussion. */
  findingId?: string;
  mentions: Role[];
  resolved?: boolean;
}

/** One external AI request, recorded whether it succeeded or failed. */
export interface AiLedgerEntry {
  id: string;
  at: string;
  by: string;
  purpose: "content review" | "conflict analysis" | "rule extraction";
  service: string;
  model: string;
  itemTitle?: string;
  brandId: string;
  /** Exactly what left the browser after redaction (truncated for storage). */
  sentPreview: string;
  sentChars: number;
  redactions: { kind: string; count: number }[];
  outcome: "ok" | "failed";
  error?: string;
}

/** A document reviewed as content; text is extracted in the browser. */
export interface DocumentMeta {
  fileName: string;
  kind: "pdf" | "docx" | "text";
  bytes: number;
  pages: { page: number; start: number; end: number }[];
}

export interface ImpactSummary {
  at: string;
  versionsTested: number;
  removed: number;
  removedDismissed: number;
  kept: number;
  keptAccepted: number;
  added: number;
  /** Findings reviewers accepted as real that would no longer be raised. */
  lostAccepted: number;
  approvedNowFailing: number;
  verdict: "safe" | "review" | "risky";
}

export interface ContentItem {
  id: string;
  title: string;
  brandId: string;
  contentType: ContentType;
  status: ContentStatus;
  text: string;
  meta: ContentMeta;
  versions: Version[];
  findings: Finding[];
  matchedFacts: MatchedFact[];
  runs: ReviewRun[];
  approvals: ApprovalRecord[];
  events: AuditEvent[];
  /** Seeded demo history — clearly labelled in UI and insights. */
  seeded: boolean;
  /** Confidential items never leave the browser: AI review is blocked. */
  confidential?: boolean;
  /** Who created the item and who is assigned to decide it (simulated personas). */
  createdBy?: Role;
  assignee?: Role;
  comments?: Comment[];
  createdAt: string;
  updatedAt: string;
}

/** A finding before the store assigns id, status and history. */
export type DraftFinding = Omit<Finding, "id" | "status" | "history">;

export interface MatchedFact {
  factId: string;
  text: string;
  kind: "exact" | "signal";
}

export type ConflictStatus = "open" | "approved" | "rejected";

export interface GuidelineConflict {
  id: string;
  brandId: string;
  ruleIds: [string, string];
  why: string;
  exampleContext: string;
  proposedRuleId: string;
  proposedText: string;
  status: ConflictStatus;
  detectedBy: string;
  decidedAt?: string;
  decisionNote?: string;
  impact?: ImpactSummary;
}

export interface AppState {
  schema: number;
  brands: Brand[];
  activeBrandId: string;
  items: ContentItem[];
  conflicts: GuidelineConflict[];
  role: Role;
  /** Every request sent to an external AI service, for disclosure. */
  aiLedger: AiLedgerEntry[];
  /** In-app usability feedback collected during testing sessions. */
  feedback?: FeedbackEntry[];
  seededAt: string;
}

/** API contract: POST /api/guidelines/analyze */
export interface ConflictAnalysisRequest {
  rules: { id: string; text: string }[];
}

export interface AiConflict {
  ruleIds: [string, string];
  why: string;
  exampleContext: string;
  proposedText: string;
  targetRuleId: string;
  confidence: number | null;
}

export type ConflictAnalysisResponse =
  | { ok: true; model: string; service: string; fallbackFrom?: AiFallback; conflicts: AiConflict[]; dropped: number }
  | { ok: false; error: { code: AiErrorCode; message: string } };

/** API contract: POST /api/review */
export interface AiReviewRequest {
  text: string;
  contentType: ContentType;
  meta: ContentMeta;
  brand: Pick<Brand, "name" | "rules" | "facts" | "bannedTerms" | "preferredTerms">;
}

export type AiErrorCode =
  | "not_configured"
  | "rate_limited"
  | "unavailable"
  | "invalid_response"
  | "bad_request"
  | "auth_failed";

export type AiReviewResponse =
  | { ok: true; model: string; service: string; fallbackFrom?: AiFallback; findings: DraftFinding[]; dropped: number }
  | { ok: false; error: { code: AiErrorCode; message: string } };

/** The provider that failed before the fallback answered. */
export interface AiFallback {
  service: string;
  model: string;
  error: string;
}

export interface AiStatusResponse {
  configured: boolean;
  /** Display name of the active provider, e.g. "OpenAI". */
  provider: string;
  /** Name used in the AI disclosure ledger, e.g. "OpenAI API". */
  service: string;
  model: string;
  verified: "yes" | "no" | "unchecked";
  message: string;
  /** Gemini, when configured as a fallback for OpenAI. */
  fallback?: { provider: string; model: string; verified: "yes" | "no" | "unchecked" } | null;
}
