"use client";

import { Download } from "lucide-react";
import { Button, Card, SectionTitle, fmtDate } from "@/components/ui";
import { useAppState } from "@/lib/store";

export function FeedbackCard() {
  const state = useAppState()!;
  const fb = state.feedback ?? [];
  const avg = fb.length ? fb.reduce((n, f) => n + f.ease, 0) / fb.length : 0;
  const done = fb.filter((f) => f.completed === "yes").length;
  const exportIt = () => {
    const blob = new Blob([JSON.stringify(fb, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "plumbline-usability-feedback.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section>
      <SectionTitle aside={fb.length > 0 && <Button size="sm" variant="ghost" onClick={exportIt}><Download size={13} /> Export</Button>}>
        Usability feedback ({fb.length})
      </SectionTitle>
      <Card className="p-5 text-sm">
        {fb.length === 0 ? (
          <p className="text-stone-600">No feedback yet. Testers can use “Give feedback” in the sidebar after each task. See docs/TESTING.md for the test script.</p>
        ) : (
          <>
            <p className="text-stone-700">
              Average ease <strong>{avg.toFixed(1)}/5</strong> · {done} of {fb.length} tasks completed fully.
            </p>
            <ul className="mt-3 space-y-1.5">
              {fb.slice(0, 8).map((f) => (
                <li key={f.id} className="text-xs text-stone-600">
                  <span className="text-stone-400">{fmtDate(f.at)}</span> · {f.role} · {f.task} · ease {f.ease}/5 · {f.completed}
                  {f.comment && <> — “{f.comment}”</>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </section>
  );
}
