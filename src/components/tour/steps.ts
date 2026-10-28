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
    body: "This opens a sample social post that has already been reviewed. Press Next and we’ll open it for you.",
  },
  {
    id: "document",
    route: "demo",
    target: "document",
    title: "See the post as it will appear",
    body: "Underlined phrases have findings: red is high risk, amber medium, grey low. Select one to open its evidence in the review panel.",
  },
  {
    id: "verdict",
    route: "demo",
    target: "verdict",
    title: "The review panel",
    body: "A plain verdict, not a score: any open high-risk finding blocks approval. Findings are grouped by juror.",
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
    title: "One place for the whole lifecycle",
    body: "Draft → In review → Changes requested → Ready for approval → Approved. Submit, request changes and approve from the bar above, without leaving the page.",
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
    body: "Switch user here to act as the Creator, Manager or authorised Reviewer. Managers approve low-risk work; only a Reviewer can override high-risk findings. Press Ctrl K to search anything.",
  },
];
