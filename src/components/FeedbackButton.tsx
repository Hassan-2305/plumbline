"use client";

import { MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button, Label, Modal, cx, inputCls } from "./ui";
import { addFeedback } from "@/lib/store";

const TASKS = ["Review a piece of content", "Fix or dismiss findings", "Submit or approve content", "Understand or change guidelines", "Read insights", "Something else"];

/** Structured usability feedback, stored locally and exportable from Settings. */
export function FeedbackButton({ compact }: { compact?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState(TASKS[0]);
  const [ease, setEase] = useState<1 | 2 | 3 | 4 | 5 | 0>(0);
  const [completed, setCompleted] = useState<"yes" | "partly" | "no">("yes");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  const close = () => {
    setOpen(false);
    setSent(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Give feedback"
        className={cx(
          compact ? "rounded-md p-1.5 text-stone-500 hover:bg-stone-100" : "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[14px] text-stone-700 hover:bg-stone-100",
        )}
      >
        <MessageSquare size={18} strokeWidth={1.75} className={compact ? "" : "text-stone-500"} />
        {!compact && "Give feedback"}
      </button>
      <Modal
        open={open}
        onClose={close}
        title="How did that go?"
        footer={
          sent ? (
            <Button variant="primary" onClick={close}>Close</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!ease}
                onClick={() => {
                  addFeedback({ page: path, task, ease: ease as 1 | 2 | 3 | 4 | 5, completed, comment: comment.trim() });
                  setSent(true);
                  setComment("");
                  setEase(0);
                }}
              >
                Send feedback
              </Button>
            </>
          )
        }
      >
        {sent ? (
          <p className="text-stone-700">Thank you. Your feedback is saved in this browser and the team can export it from Settings.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="fb-task">What were you trying to do?</Label>
              <select id="fb-task" className={inputCls} value={task} onChange={(e) => setTask(e.target.value)}>
                {TASKS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-stone-700">Did you manage it?</legend>
              <div className="flex gap-1.5">
                {(["yes", "partly", "no"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={completed === c}
                    onClick={() => setCompleted(c)}
                    className={cx("rounded-full px-3 py-1 text-xs capitalize ring-1", completed === c ? "bg-stone-900 text-white ring-stone-900" : "ring-stone-200 text-stone-700")}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-stone-700">How easy was it? (1 = very hard, 5 = very easy)</legend>
              <div className="flex gap-1.5">
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={ease === n}
                    onClick={() => setEase(n)}
                    className={cx("h-9 w-9 rounded-lg text-sm font-medium ring-1", ease === n ? "bg-amber-600 text-white ring-amber-600" : "ring-stone-200 text-stone-700 hover:bg-stone-50")}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <Label htmlFor="fb-comment">Anything confusing or missing? (optional)</Label>
              <textarea id="fb-comment" className={inputCls} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <p className="text-[11px] text-stone-500">No personal data is collected. Stored only in this browser.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
