"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui";
import { EXAMPLES } from "@/lib/seed/examples";
import { TypeIcon } from "./ContentThumb";

/** Starting points: each template opens a new draft pre-filled with a fictional example. */
export function TemplatesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Start from a template">
      <p className="mb-3 text-stone-600">Fictional Northstar drafts you can edit and review. Each one shows a different kind of issue.</p>
      <ul className="space-y-2">
        {EXAMPLES.map((e) => (
          <li key={e.id}>
            <Link
              href={`/content/new?example=${e.id}`}
              onClick={onClose}
              className="group flex items-start gap-3 rounded-xl border border-stone-200 p-3 transition-colors hover:border-accent-300 hover:bg-accent-50/40"
            >
              <TypeIcon type={e.contentType} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-stone-900">{e.title}</span>
                <span className="block text-xs text-stone-500">{e.contentType} · {e.blurb}</span>
              </span>
              <ArrowRight size={15} className="mt-1 text-stone-300 transition-colors group-hover:text-accent-600" />
            </Link>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
