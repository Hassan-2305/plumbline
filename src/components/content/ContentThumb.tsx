"use client";

import { FileText, Mail, Megaphone, Newspaper, PanelTop, Share2 } from "lucide-react";
import { cx } from "@/components/ui";
import type { ContentItem, ContentType } from "@/lib/types";

export const TYPE_META: Record<ContentType, { icon: typeof FileText; tint: string }> = {
  "Social post": { icon: Share2, tint: "bg-pink-50 text-pink-600" },
  "Marketing email": { icon: Mail, tint: "bg-sky-50 text-sky-600" },
  "Web copy": { icon: PanelTop, tint: "bg-emerald-50 text-emerald-600" },
  "Ad copy": { icon: Megaphone, tint: "bg-amber-50 text-amber-600" },
  "Press release": { icon: Newspaper, tint: "bg-violet-50 text-violet-600" },
  Document: { icon: FileText, tint: "bg-stone-100 text-stone-600" },
};

export function TypeIcon({ type, size = 32 }: { type: ContentType; size?: number }) {
  const m = TYPE_META[type] ?? TYPE_META.Document;
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-lg", m.tint)} style={{ width: size, height: size }}>
      <m.icon size={size * 0.5} />
    </span>
  );
}

/** The content's own image or first video frame; otherwise an excerpt of its text. Never a stock photo. */
export function ContentThumb({ item, className }: { item: ContentItem; className?: string }) {
  const src = item.meta.image?.thumb ?? item.meta.video?.frames[0]?.thumb;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local data URL or bundled demo asset
      <img src={src} alt={item.meta.altText || ""} className={cx("w-full rounded-lg bg-stone-100 object-cover", className)} />
    );
  }
  const body = item.text.replace(/^\s*Subject:.*\n+/i, "").trim();
  return (
    <div className={cx("flex w-full items-center rounded-lg bg-stone-50 px-4 text-[13px] leading-relaxed text-stone-700", className)}>
      <p className="line-clamp-3">{body || "Empty draft"}</p>
    </div>
  );
}
