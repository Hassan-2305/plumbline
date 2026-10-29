"use client";

import { Download, FileUp, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge, Button, PageHeader, Skeleton } from "@/components/ui";
import { useAppState } from "@/lib/store";
import { useAiStatus } from "@/lib/useAiStatus";

function Row({ icon, name, status, children }: { icon: React.ReactNode; name: string; status: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="grid gap-3 py-4 sm:grid-cols-[220px_minmax(0,1fr)]">
      <div className="flex items-center gap-2">
        <span className="text-stone-500">{icon}</span>
        <span className="text-[13px] font-medium text-stone-900">{name}</span>
        {status}
      </div>
      <div className="text-[13px] text-stone-600">{children}</div>
    </li>
  );
}

/** Real connections only: the AI provider, document import and data export. */
export default function IntegrationsPage() {
  const state = useAppState();
  const ai = useAiStatus();
  if (!state) return <Skeleton />;

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "plumbline-jury-export.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <PageHeader title="Integrations" description="What this workspace connects to. Nothing else is called." />
      <ul className="divide-y divide-stone-200 border-y border-stone-200">
        <Row
          icon={<Sparkles size={15} />}
          name={ai?.provider ?? "AI provider"}
          status={
            !ai ? <Badge>Checking</Badge> : ai.configured && ai.verified !== "no" ? <Badge tone="green">Connected</Badge> : ai.configured ? <Badge tone="red">Problem</Badge> : <Badge>Not configured</Badge>
          }
        >
          <p>Optional AI jurors, guideline conflict analysis and rule extraction. Model: <span className="font-mono text-xs">{ai?.model || "—"}</span>.</p>
          <p className="mt-1 text-xs text-stone-500">
            {ai?.message} The key lives in server environment variables (OPENAI_API_KEY, OPENAI_MODEL) and is never sent to the browser. Every request is redacted and logged in{" "}
            <Link href="/settings" className="text-accent-700 hover:underline">Settings</Link>.
          </p>
        </Row>
        <Row icon={<FileUp size={15} />} name="Brand-book import" status={<Badge tone="green">Built in</Badge>}>
          <p>Import rules, banned terms, preferred terms and colours from PDF, Word, TXT or Markdown. Files are read in the browser and never uploaded.</p>
          <Link href="/guidelines" className="mt-1 inline-block text-xs font-medium text-accent-700 hover:underline">Import from Guidelines →</Link>
        </Row>
        <Row icon={<Download size={15} />} name="Data export" status={<Badge tone="green">Built in</Badge>}>
          <p>Download everything in this browser (workspaces, content, findings, decisions, comments, AI log) as JSON.</p>
          <Button size="sm" className="mt-2" onClick={exportData}>
            <Download size={12} /> Export JSON
          </Button>
        </Row>
      </ul>
      <p className="mt-4 text-xs text-stone-500">Publishing tools (social schedulers, email platforms, CMS) are not connected. Approval applies inside Plumbline Jury only.</p>
    </div>
  );
}
