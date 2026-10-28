import type { Role } from "./types";

// Simulated roles and permissions. There is no authentication in this
// prototype; the matrix is enforced in the store and reflected in the UI.

export const ROLES: { id: Role; label: string; person: string; blurb: string }[] = [
  { id: "creator", label: "Creator", person: "Priya (Creator)", blurb: "Writes drafts, resolves findings, submits for approval and proposes guideline changes." },
  { id: "manager", label: "Manager", person: "Marcus (Manager)", blurb: "Requests changes and approves low-risk content. Escalated or high-risk content goes to a reviewer." },
  { id: "reviewer", label: "Reviewer", person: "Dana (Brand reviewer)", blurb: "Authorised approver. Can override high-risk findings with a reason and approves guideline, fact and asset changes." },
];

export type Action =
  | "content.edit"
  | "content.submit"
  | "content.requestChanges"
  | "content.approve"
  | "content.override"
  | "finding.resolve"
  | "guideline.propose"
  | "guideline.approve"
  | "comment";

const MATRIX: Record<Action, Role[]> = {
  "content.edit": ["creator", "manager", "reviewer"],
  "content.submit": ["creator", "manager"],
  "content.requestChanges": ["manager", "reviewer"],
  "content.approve": ["manager", "reviewer"],
  "content.override": ["reviewer"],
  "finding.resolve": ["creator", "manager", "reviewer"],
  "guideline.propose": ["creator", "manager", "reviewer"],
  "guideline.approve": ["reviewer"],
  comment: ["creator", "manager", "reviewer"],
};

export function can(role: Role, action: Action) {
  return MATRIX[action].includes(role);
}

export function roleMeta(role: Role) {
  return ROLES.find((r) => r.id === role)!;
}

/** All roles allowed to perform an action, for "who can do this" hints. */
export function whoCan(action: Action) {
  return MATRIX[action].map((r) => roleMeta(r).label);
}

export const PERMISSION_ROWS: { action: Action; label: string }[] = [
  { action: "content.submit", label: "Submit content for approval" },
  { action: "finding.resolve", label: "Accept, dismiss or escalate findings" },
  { action: "content.requestChanges", label: "Request changes" },
  { action: "content.approve", label: "Approve content (no open high-risk or escalated findings)" },
  { action: "content.override", label: "Override high-risk findings with a reason" },
  { action: "guideline.propose", label: "Propose rule, term or fact changes" },
  { action: "guideline.approve", label: "Approve guideline, fact and asset changes" },
  { action: "comment", label: "Comment and @mention" },
];
