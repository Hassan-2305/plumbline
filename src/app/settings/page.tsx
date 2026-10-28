"use client";

import { CheckCircle2, Download, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { Badge, Button, Card, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { activeBrand, deleteBrand, loadDemo, resetDemo, setActiveBrand, useAppState } from "@/lib/store";
import { BrandMark, CreateBrandModal } from "@/components/brands/BrandSwitcher";
import { PrivacySection } from "@/components/settings/PrivacySection";
import { FeedbackCard } from "@/components/settings/FeedbackCard";
import { useState } from "react";
import Link from "next/link";
import { useAiStatus } from "@/lib/useAiStatus";

export default function SettingsPage() {
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
    <div className="space-y-8 max-w-3xl">
      <PageHeader title="Settings" description="AI configuration, demo data and the limits of this prototype." />

      <section>
        <SectionTitle>Live AI jurors</SectionTitle>
        <Card className="p-5 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={16} />
            <span className="font-medium">Google Gemini</span>
            {!ai ? (
              <Badge>Checking…</Badge>
            ) : ai.configured && ai.verified !== "no" ? (
              <Badge tone="green"><CheckCircle2 size={11} /> Configured</Badge>
            ) : ai.configured ? (
              <Badge tone="red"><XCircle size={11} /> Problem</Badge>
            ) : (
              <Badge tone="outline">Not configured</Badge>
            )}
          </div>
          {ai && (
            <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-xs">
              <dt className="text-stone-500">Model</dt>
              <dd className="font-mono">{ai.model || "—"}</dd>
              <dt className="text-stone-500">Model check</dt>
              <dd>{!ai.configured ? "Skipped" : ai.verified === "yes" ? "Verified available" : ai.verified === "no" ? "Failed" : "Not checked"} — {ai.message}</dd>
            </dl>
          )}
          <p className="text-stone-600">
            The API key lives only in server environment variables (<code className="text-xs bg-stone-100 px-1 rounded">GEMINI_API_KEY</code>, optional{" "}
            <code className="text-xs bg-stone-100 px-1 rounded">GEMINI_MODEL</code>). It is never sent to the browser and cannot be entered here.
          </p>
          <p className="text-stone-600">
            Without a key, deterministic checks and the labelled seeded demo results still work. Failed AI calls are reported as failures — never shown as AI results.
          </p>
          <p className="text-stone-600">
            <strong>Data handling:</strong> when live AI is used, the draft text, its metadata and the brand’s rules and facts are sent to Google’s Gemini API. Free-tier
            terms may allow the provider to use submitted data. Do not submit confidential content.
          </p>
        </Card>
      </section>

      <PrivacySection />

      <BrandsCard />

      <FeedbackCard />

      <section>
        <SectionTitle>Demo data</SectionTitle>
        <Card className="p-5 space-y-4 text-sm">
          <p className="text-stone-600">
            Northstar Nutrition, its rules, facts and the seeded review history are fictional. Seeded items are labelled everywhere they appear.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={loadDemo}>Load Demo</Button>
            <Button
              variant="danger"
              onClick={() => confirm("Reset everything to the original demo state? Your drafts and decisions will be removed.") && resetDemo()}
            >
              <RotateCcw size={14} /> Reset Demo
            </Button>
            <Button variant="ghost" onClick={exportData}>
              <Download size={14} /> Export JSON
            </Button>
          </div>
          <p className="text-xs text-stone-500">
            Load Demo restores Northstar and its seeded history but keeps your drafts and brands. Reset Demo restores the exact original state and removes brands you
            created.
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle>Team & permissions</SectionTitle>
        <p className="text-[13px] text-stone-600">
          People, roles and the permission matrix moved to <Link href="/team" className="text-accent-700 hover:underline">Team & permissions</Link>. Switch user from the profile menu at
          the bottom of the sidebar.
        </p>
      </section>

      <section>
        <SectionTitle>Storage and limitations</SectionTitle>
        <Card className="p-5 text-sm text-stone-600 space-y-2">
          <p>Data is stored in this browser’s localStorage. It is prototype persistence — not secure storage, not synchronised between users or devices, and not a tamper-proof audit trail.</p>
          <p>Approval in Plumbline Jury applies only inside this app; it cannot block publication on external platforms.</p>
          <p>AI findings are assessments, not legal advice. Model confidence values are self-reported and not calibrated probabilities.</p>
          <p>
            Uploaded images are analysed in the browser only: file metadata, dominant colours against the palette, and whole-file logo similarity and proportions. Nothing
            identifies what an image depicts, finds a logo inside a larger image, or tests screen-reader behaviour. Images are never sent to the AI.
          </p>
          <p>
            Videos are sampled in the browser: up to 12 evenly spaced frames are compared with the palette. Audio is not transcribed and there is no frame-by-frame or
            flashing-content analysis. Spoken claims are checked only through an attached caption file.
          </p>
          <p>
            Brand-book import reads selectable text from PDF, TXT and Markdown files in the browser. Scanned PDFs (images of text) are not supported. Detected rules are
            pattern-based suggestions. AI suggestions are optional and must quote the document. Everything becomes a proposal that a reviewer approves.
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle>Roadmap — not implemented</SectionTitle>
        <Card className="p-5 text-sm text-stone-600">
          <p className="mb-2 text-xs text-stone-500">These are ideas only. None of them work in this prototype.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Audio transcription, so spoken claims can be reviewed without a caption file.</li>
            <li>On-screen text (OCR) in images and video frames, and OCR for scanned brand books.</li>
            <li>Flashing-content (seizure risk) analysis and frame-by-frame video review.</li>
            <li>Locating logos inside larger images and checking clear space.</li>
            <li>Real accounts, role-based access control, shared multi-user storage and tamper-evident audit logs.</li>
            <li>Publishing integrations that respect approval status.</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}

function BrandsCard() {
  const state = useAppState()!;
  const [creating, setCreating] = useState(false);
  const active = activeBrand(state);
  return (
    <section>
      <SectionTitle aside={<Button size="sm" onClick={() => setCreating(true)}>New workspace</Button>}>Workspaces</SectionTitle>
      <Card className="divide-y divide-stone-100">
        {state.brands.map((b) => {
          const count = state.items.filter((i) => i.brandId === b.id).length;
          return (
            <div key={b.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <BrandMark brand={b} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-stone-900">{b.name} {b.fictional && <span className="text-xs font-normal text-amber-700">· fictional demo</span>}</div>
                <div className="text-xs text-stone-500">
                  {b.rules.length} rules · {b.facts.length} facts · {count} content item{count === 1 ? "" : "s"}
                </div>
              </div>
              {b.id === active.id ? (
                <span className="text-xs text-stone-500">In view</span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setActiveBrand(b.id)}>Switch</Button>
              )}
              {!b.fictional && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => confirm(`Delete ${b.name} and its ${count} content item(s)? This cannot be undone.`) && deleteBrand(b.id)}
                >
                  Delete
                </Button>
              )}
            </div>
          );
        })}
      </Card>
      <CreateBrandModal open={creating} onClose={() => setCreating(false)} />
    </section>
  );
}
