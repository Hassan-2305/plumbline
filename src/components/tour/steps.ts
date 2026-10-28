// Guided walkthrough content. Targets are `data-tour` attributes in the UI.
// Keep copy short: one idea per step, written for a first-time judge.

export interface TourStep {
  id: string;
  /** Route to show; "demo" resolves to the tour's demo item. */
  route?: string;
  target?: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    route: "/",
    title: "Welcome to Plumbline Jury",
    body: "Plumbline Jury reviews marketing copy before it goes out. Four AI and rule-based jurors flag issues, every objection cites real evidence, and a human makes every call. This tour takes about a minute.",
  },
  {
    id: "try-demo",
    route: "/",
    target: "try-demo",
    title: "Start with a demo",
    body: "This opens a sample social post that the jury has already reviewed. Press Next and we’ll open it for you.",
  },
  {
    id: "document",
    route: "demo",
    target: "document",
    title: "Issues are marked in the text",
    body: "Each highlight is a finding. Red is high risk, orange is medium, grey is low. Click a highlight to jump to its explanation.",
  },
  {
    id: "verdict",
    route: "demo",
    target: "verdict",
    title: "A clear verdict, not a mystery score",
    body: "The rule is simple: any open high-risk finding blocks approval. Fix or dismiss findings to clear the way.",
  },
  {
    id: "finding",
    route: "demo",
    target: "finding",
    title: "Every objection shows its evidence",
    body: "Each finding quotes the exact brand rule or approved fact behind it, checked against the brand library. If no fact supports a claim, it says so plainly.",
  },
  {
    id: "actions",
    route: "demo",
    target: "finding-actions",
    title: "You decide",
    body: "Accept the minimal fix, edit it, dismiss it with a reason, or escalate it. Every decision is saved to the history.",
  },
  {
    id: "stepper",
    route: "demo",
    target: "stepper",
    title: "Follow the workflow",
    body: "Draft → Jury review → Resolve → Approval. Resolve findings, discuss them with @mentions, then submit from the Approval tab for a manager or reviewer to decide.",
  },
  {
    id: "conflict",
    route: "/guidelines",
    target: "conflict",
    title: "Guidelines that contradict each other",
    body: "R-001 asks for a conversational voice and R-009 asks for a formal one. Plumbline flags the clash and drafts a clarification. Nothing changes until a reviewer approves it.",
  },
  {
    id: "impact",
    route: "/guidelines",
    target: "impact-test",
    title: "Test a rule change before it ships",
    body: "Run test replays every reviewed item under the old and new wording and scores it against what reviewers actually decided: noise removed, real issues still caught, real issues lost, and approved work that would now fail.",
  },
  {
    id: "insights",
    route: "/insights",
    target: "confusing",
    title: "Human decisions become signals",
    body: "When reviewers keep dismissing findings under a rule as “unclear”, that rule appears here so the brand team can improve it.",
  },
  {
    id: "role",
    route: "/insights",
    target: "role-switch",
    title: "You’re ready",
    body: "Switch between Creator, Manager and authorised Reviewer to try every step. Managers approve low-risk work; only a Reviewer can override high-risk findings. Restart this tour any time from the sidebar.",
  },
];
