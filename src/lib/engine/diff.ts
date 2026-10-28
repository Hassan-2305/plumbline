// Word-level diff (LCS) for before/after views.

export type DiffPart = { type: "same" | "add" | "del"; text: string };

export function diffWords(a: string, b: string): DiffPart[] {
  const x = a.split(/(\s+)/);
  const y = b.split(/(\s+)/);
  const n = x.length;
  const m = y.length;
  // Guard against very long inputs in the browser.
  if (n * m > 4_000_000) return [{ type: "del", text: a }, { type: "add", text: b }];
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      push("same", x[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("del", x[i++]);
    } else {
      push("add", y[j++]);
    }
  }
  while (i < n) push("del", x[i++]);
  while (j < m) push("add", y[j++]);
  return out;
}

/** Replace the first occurrence of `find` (exact, then case-insensitive). Returns null if absent. */
export function applyLocalFix(text: string, find: string, replacement: string): string | null {
  let idx = text.indexOf(find);
  if (idx < 0) idx = text.toLowerCase().indexOf(find.toLowerCase());
  if (idx < 0) return null;
  return text.slice(0, idx) + replacement + text.slice(idx + find.length);
}
