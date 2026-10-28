import type { DraftFinding, Finding } from "../types";

// Coordinating stage: merges duplicates across jurors/sources and preserves
// meaningful disagreements instead of hiding them.

function norm(s?: string) {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function overlapText(a?: string, b?: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

const SEV = { high: 3, medium: 2, low: 1 } as const;

export function coordinate(deterministic: DraftFinding[], ai: DraftFinding[]): DraftFinding[] {
  const out: DraftFinding[] = deterministic.map((f) => ({ ...f }));
  for (const f of ai) {
    const dup = out.find(
      (d) => overlapText(d.offendingText, f.offendingText) && d.ruleIds.some((r) => f.ruleIds.includes(r)),
    );
    if (dup) {
      if (dup.juror === f.juror && dup.severity === f.severity) {
        dup.coordinatorNote = appendNote(dup.coordinatorNote, `Corroborated by AI-assisted ${f.juror}.`);
        continue;
      }
      if (dup.severity !== f.severity) {
        const note = `Disagreement: ${dup.juror} (${dup.source}) rated this ${dup.severity}; ${f.juror} (${f.source}) rated it ${f.severity}. Both kept for human judgement.`;
        dup.coordinatorNote = appendNote(dup.coordinatorNote, note);
        out.push({ ...f, coordinatorNote: appendNote(f.coordinatorNote, note) });
        continue;
      }
      dup.coordinatorNote = appendNote(dup.coordinatorNote, `Also raised by AI-assisted ${f.juror}.`);
      continue;
    }
    out.push(f);
  }
  return out.sort((a, b) => SEV[b.severity] - SEV[a.severity]);
}

function appendNote(existing: string | undefined, note: string) {
  return existing ? `${existing} ${note}` : note;
}

export function signature(f: Pick<Finding, "category" | "offendingText" | "ruleIds">) {
  return `${f.category}|${norm(f.offendingText)}|${[...f.ruleIds].sort().join(",")}`;
}
