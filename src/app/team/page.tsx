"use client";

import { Check, Minus } from "lucide-react";
import { PageHeader, SectionTitle, Skeleton, cx } from "@/components/ui";
import { Avatar } from "@/components/content/ContentList";
import { brandItems, setRole, useAppState } from "@/lib/store";
import { can, PERMISSION_ROWS, ROLES } from "@/lib/roles";

export default function TeamPage() {
  const state = useAppState();
  if (!state) return <Skeleton />;
  const items = brandItems(state);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Team & permissions"
        description="Three simulated people so the whole workflow can be tried without logins. The permissions below are enforced throughout the app."
      />
      <section>
        <SectionTitle>People</SectionTitle>
        <ul className="divide-y divide-stone-200 border-y border-stone-200">
          {ROLES.map((r) => {
            const created = items.filter((i) => i.createdBy === r.id).length;
            const assigned = items.filter((i) => i.assignee === r.id && i.status === "ready_for_approval").length;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar role={r.id} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-stone-900">
                    {r.person} {state.role === r.id && <span className="ml-1 text-xs font-normal text-accent-700">you</span>}
                  </div>
                  <div className="text-xs text-stone-500">{r.blurb}</div>
                </div>
                <div className="text-xs text-stone-500">
                  {created} created · {assigned} awaiting their decision
                </div>
                {state.role !== r.id && (
                  <button onClick={() => setRole(r.id)} className="text-xs font-medium text-accent-700 hover:underline">
                    Switch to {r.label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <SectionTitle>Permissions</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                <th className="py-2 font-medium">Action</th>
                {ROLES.map((r) => (
                  <th key={r.id} className={cx("w-28 py-2 text-center font-medium", state.role === r.id && "text-stone-900")}>{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {PERMISSION_ROWS.map((row) => (
                <tr key={row.action}>
                  <td className="py-2 text-stone-700">{row.label}</td>
                  {ROLES.map((r) => (
                    <td key={r.id} className={cx("py-2 text-center", state.role === r.id && "bg-stone-50")}>
                      {can(r.id, row.action) ? <Check size={14} className="inline text-emerald-600" aria-label="Allowed" /> : <Minus size={14} className="inline text-stone-300" aria-label="Not allowed" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-stone-500">
          There’s no authentication in this prototype; a real deployment needs identity and server-side authorisation. Content is assigned to a manager by default and can be reassigned
          from the review screen.
        </p>
      </section>
    </div>
  );
}
