// Guided walkthrough content. Targets are `data-tour` attributes in the UI.
// Keep copy short: one idea per step, written for a first-time judge.

/** The workflow the tour teaches, shown as a strip on every step. */
export const TOUR_STAGES = ["Create", "Review", "Decide", "Approve", "Improve"] as const;
export type TourStage = (typeof TOUR_STAGES)[number];

export interface TourStep {
  id: string;
  /** Route to show; "demo" resolves to the tour's demo item. Omit to stay on the current page. */
  route?: string;
  target?: string;
  stage?: TourStage;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Plumbline Jury",
    body: "Plumbline Jury checks marketing content against a brand’s rules and approved facts before it goes out. It flags issues with evidence; people make every decision. Here is the whole workflow in about a minute.",
  },
  {
    id: "create",
    route: "/",
    target: "create-cta",
    stage: "Create",
    title: "1. Create or upload content",
    body: "Write or paste copy, upload an image, video, PDF or DOCX, or start from a template. Then run a review.",
  },
  {
    id: "try-demo",
    route: "/",
    target: "try-demo",
    stage: "Review",
    title: "2. Review: we’ll use a sample",
    body: "This sample social post has already been reviewed. Press Next and we’ll open it for you.",
  },
  {
    id: "document",
    route: "demo",
    target: "document",
    stage: "Review",
    title: "Issues are marked in place",
    body: "Underlined phrases have findings: red is high risk, amber medium, grey low. Select one to jump to its evidence.",
  },
  {
    id: "verdict",
    route: "demo",
    target: "verdict",
    stage: "Review",
    title: "A plain verdict, not a score",
    body: "Any open high-risk finding blocks approval. Findings are grouped by juror: Brand Guardian, Fact-Checker, Risk & Compliance and Accessibility Advocate.",
  },
  {
    id: "finding",
    route: "demo",
    target: "finding",
    stage: "Review",
    title: "Every objection shows its evidence",
    body: "Each finding quotes the exact brand rule or approved fact behind it. If no fact supports a claim, it says so plainly instead of guessing.",
  },
  {
    id: "actions",
    route: "demo",
    target: "finding-actions",
    stage: "Decide",
    title: "3. You decide",
    body: "Accept the suggested fix, edit it, dismiss it with a reason, or escalate it. Every decision is saved to the history.",
  },
  {
    id: "stepper",
    route: "demo",
    target: "stepper",
    stage: "Approve",
    title: "4. Submit and approve",
    body: "Draft → In review → Changes requested → Ready for approval → Approved. Submit, request changes and approve from this bar, without leaving the page.",
  },
  {
    id: "conflict",
    route: "/guidelines",
    target: "conflict",
    stage: "Improve",
    title: "5. Improve the guidelines",
    body: "R-001 asks for a conversational voice and R-009 asks for a formal one. Plumbline flags the clash and drafts a clarification. Nothing changes until a reviewer approves it.",
  },
  {
    id: "impact",
    route: "/guidelines",
    target: "impact-test",
    stage: "Improve",
    title: "Test a rule change before it ships",
    body: "Replays every reviewed item under the old and new wording and compares the result with what reviewers actually decided: noise removed, real issues still caught, and anything lost.",
  },
  {
    id: "insights",
    route: "/insights",
    target: "confusing",
    stage: "Improve",
    title: "Human decisions become signals",
    body: "When reviewers keep dismissing a rule’s findings as “unclear”, it shows up here so the brand team can fix the rule.",
  },
  {
    id: "role",
    route: "/insights",
    target: "role-switch",
    title: "You’re ready",
    body: "Switch user here to act as the Creator, Manager or Reviewer; each sees different actions. Replay this tour any time from “Product tour”, and press Ctrl K to search.",
  },
];
