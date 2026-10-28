"use client";

import { AtSign, Check, MessageSquare, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Badge, Button, cx, fmtDate, inputCls } from "@/components/ui";
import { addComment, resolveComment, useAppState } from "@/lib/store";
import { ROLES } from "@/lib/roles";
import type { Comment } from "@/lib/types";

function renderText(text: string) {
  return text.split(/(@(?:creator|manager|reviewer)\b)/gi).map((part, i) =>
    /^@(creator|manager|reviewer)$/i.test(part) ? (
      <span key={i} className="rounded bg-orange-100 px-1 font-medium text-orange-800">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function CommentThread({ itemId, comments, findingId, placeholder }: { itemId: string; comments: Comment[]; findingId?: string; placeholder?: string }) {
  const state = useAppState()!;
  const [text, setText] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const thread = comments.filter((c) => (findingId ? c.findingId === findingId : !c.findingId));
  const visible = thread.filter((c) => showResolved || !c.resolved);
  const resolvedCount = thread.filter((c) => c.resolved).length;
  const send = () => {
    addComment(itemId, text, findingId);
    setText("");
  };

  return (
    <div className="space-y-3">
      {visible.length === 0 && <p className="text-xs text-stone-500">No comments yet.</p>}
      <ul className="space-y-2.5">
        {visible.map((c) => {
          const mine = c.mentions.includes(state.role) && !c.resolved;
          return (
            <li key={c.id} className={cx("rounded-lg border px-3 py-2", c.resolved ? "border-stone-100 bg-stone-50 opacity-70" : mine ? "border-orange-200 bg-orange-50/50" : "border-stone-200 bg-white")}>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500">
                <span className="font-medium text-stone-800">{c.by}</span>
                <span>· {fmtDate(c.at)}</span>
                {mine && <Badge tone="orange">Mentions you</Badge>}
                {c.resolved && <Badge>Resolved</Badge>}
                <button
                  className="ml-auto inline-flex items-center gap-1 rounded px-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                  onClick={() => resolveComment(itemId, c.id, !c.resolved)}
                >
                  {c.resolved ? <><RotateCcw size={11} /> Reopen</> : <><Check size={11} /> Resolve</>}
                </button>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-stone-800">{renderText(c.text)}</p>
            </li>
          );
        })}
      </ul>
      {resolvedCount > 0 && (
        <button className="text-[11px] text-stone-500 underline" onClick={() => setShowResolved(!showResolved)}>
          {showResolved ? "Hide" : "Show"} {resolvedCount} resolved
        </button>
      )}
      <div className="space-y-1.5">
        <label htmlFor={`comment-${findingId ?? itemId}`} className="sr-only">Add a comment</label>
        <textarea
          id={`comment-${findingId ?? itemId}`}
          className={inputCls}
          rows={2}
          value={text}
          placeholder={placeholder ?? "Add a comment… use @manager or @reviewer to ask for input"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) send();
          }}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] text-stone-500"><AtSign size={11} /> Mention:</span>
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}@${r.id} `)}
              className="rounded-full border border-stone-200 px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-50"
            >
              {r.label}
            </button>
          ))}
          <Button size="sm" variant="primary" className="ml-auto" disabled={!text.trim()} onClick={send}>
            <MessageSquare size={12} /> Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
