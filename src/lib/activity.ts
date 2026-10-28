import type { AppState, ContentItem } from "./types";

export interface ActivityEntry {
  at: string;
  by: string;
  text: string;
  kind: "content" | "comment" | "decision" | "guideline";
  itemId?: string;
  itemTitle?: string;
  href?: string;
}

/** One chronological feed for the workspace: content events, comments and guideline changes. */
export function workspaceActivity(s: AppState, limit = 50): ActivityEntry[] {
  const items: ContentItem[] = s.items.filter((i) => i.brandId === s.activeBrandId);
  const brand = s.brands.find((b) => b.id === s.activeBrandId) ?? s.brands[0];
  const out: ActivityEntry[] = [];
  for (const i of items) {
    if (i.seeded) {
      // Seeded history has no event log; surface its recorded decisions instead.
      for (const f of i.findings)
        for (const h of f.history.filter((x) => x.action !== "created"))
          out.push({
            at: h.at,
            by: h.by,
            text: `${h.action === "dismissed" ? `Dismissed a finding (${f.title})${h.reason ? ` as ${h.reason}` : ""}` : h.action === "escalated" ? `Escalated a finding (${f.title})` : `Accepted a fix (${f.title})`}${h.note ? `. ${h.note}` : ""}`,
            kind: "content",
            itemId: i.id,
            itemTitle: i.title,
            href: `/content/${i.id}`,
          });
      for (const a of i.approvals)
        out.push({
          at: a.at,
          by: a.reviewer,
          text: a.decision === "approved" ? `Approved v${a.versionNumber}` : `Requested changes on v${a.versionNumber}${a.note ? `: ${a.note}` : ""}`,
          kind: "decision",
          itemId: i.id,
          itemTitle: i.title,
          href: `/content/${i.id}`,
        });
      continue;
    }
    for (const e of i.events) {
      if (e.text.startsWith("Commented")) continue; // shown with the comment text instead
      const decision = /^(Approved|Requested changes|Submitted)/.test(e.text);
      out.push({ at: e.at, by: e.by, text: e.text, kind: decision ? "decision" : "content", itemId: i.id, itemTitle: i.title, href: `/content/${i.id}` });
    }
    for (const c of i.comments ?? []) {
      out.push({ at: c.at, by: c.by, text: c.text, kind: "comment", itemId: i.id, itemTitle: i.title, href: `/content/${i.id}` });
    }
  }
  for (const e of brand.changelog ?? []) out.push({ at: e.at, by: e.by, text: e.text, kind: "guideline", href: "/guidelines" });
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export function openFindingCounts(i: ContentItem) {
  const open = i.findings.filter((f) => f.status === "open" || f.status === "escalated");
  return { open: open.length, high: open.filter((f) => f.severity === "high").length };
}

const ISSUE_GROUPS: { label: string; color: string; categories: string[] }[] = [
  { label: "Unsupported claims", color: "bg-red-500", categories: ["unsupported_claim", "unsupported_number", "clinical_claim", "contradicts_fact", "misleading_claim", "absolute_guarantee", "superlative"] },
  { label: "Tone mismatch", color: "bg-orange-500", categories: ["tone", "guideline_conflict", "messaging"] },
  { label: "Outdated information", color: "bg-amber-400", categories: ["expired_fact"] },
  { label: "Terminology", color: "bg-violet-400", categories: ["banned_term", "preferred_term"] },
  { label: "Logo or visual usage", color: "bg-stone-400", categories: ["logo_mismatch", "logo_distortion", "image_palette", "video_palette", "off_palette_colour"] },
  { label: "Accessibility issues", color: "bg-stone-300", categories: ["contrast", "missing_alt_text", "weak_alt_text", "readability", "accessibility", "missing_captions", "captions_quality"] },
];

/** Findings raised in the given items, grouped into plain-language issue types. */
export function topIssues(items: ContentItem[]) {
  const all = items.flatMap((i) => i.findings);
  return ISSUE_GROUPS.map((g) => ({ ...g, count: all.filter((f) => g.categories.includes(f.category)).length }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count);
}
