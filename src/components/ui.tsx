"use client";

import { ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ContentStatus, FindingSource, FindingStatus, Severity, Verification } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-stone-900 text-white hover:bg-stone-800 border border-stone-900 shadow-soft",
  accent: "bg-orange-600 text-white hover:bg-orange-700 border border-orange-600 shadow-[0_1px_2px_rgb(234_88_12/0.25),0_4px_12px_-4px_rgb(234_88_12/0.45)]",
  secondary: "bg-white text-stone-900 border border-stone-200 hover:border-stone-300 hover:bg-stone-50 shadow-soft",
  ghost: "text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-transparent",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap",
        size === "sm" ? "h-8 px-3 text-xs" : size === "lg" ? "h-11 px-5 text-sm" : "h-9 px-3.5 text-sm",
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: Variant;
  size?: "md" | "lg";
  className?: string;
  children: ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      href={href}
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors text-sm whitespace-nowrap",
        size === "lg" ? "h-11 px-5" : "h-9 px-3.5",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

type Tone = "neutral" | "orange" | "red" | "green" | "dark" | "outline" | "amber";
export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-stone-100 text-stone-700 ring-stone-200",
    orange: "bg-orange-50 text-orange-800 ring-orange-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    dark: "bg-stone-900 text-white ring-stone-900",
    outline: "bg-white text-stone-600 ring-stone-300",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset leading-4 whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export const SEVERITY_DOT: Record<Severity, string> = { high: "bg-red-600", medium: "bg-orange-500", low: "bg-stone-400" };

export function SeverityBadge({ s }: { s: Severity }) {
  const map = { high: "red", medium: "orange", low: "neutral" } as const;
  return (
    <Badge tone={map[s]} className="uppercase tracking-wide">
      <span className={cx("h-1.5 w-1.5 rounded-full", SEVERITY_DOT[s])} />
      {s}
    </Badge>
  );
}

export function SourceBadge({ source, verification }: { source: FindingSource; verification: Verification }) {
  if (verification === "unverified") return <Badge tone="amber">Unverified</Badge>;
  if (source === "deterministic") return <Badge tone="dark">Deterministic</Badge>;
  if (source === "ai") return <Badge tone="outline">AI-assisted</Badge>;
  return <Badge tone="outline" className="ring-0 border border-dashed border-stone-400">Seeded demo result</Badge>;
}

export const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: "Draft",
  under_review: "Under Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  const tone = { draft: "neutral", under_review: "orange", changes_requested: "red", approved: "green" } as const;
  return <Badge tone={tone[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  const map = {
    open: ["Open", "outline"],
    accepted: ["Fix accepted", "green"],
    edited: ["Fix edited", "green"],
    dismissed: ["Dismissed", "neutral"],
    escalated: ["Escalated", "orange"],
  } as const;
  const [label, tone] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx("rounded-xl border border-stone-200/80 bg-white shadow-soft", className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 pb-6 mb-6 border-b border-stone-200 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="font-serif text-[2.15rem] leading-tight tracking-tight text-stone-950">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-stone-600 max-w-2xl leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside, id }: { children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 id={id} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">{children}</h2>
      {aside}
    </div>
  );
}

export function IconChip({ children, tone = "stone" }: { children: ReactNode; tone?: "stone" | "orange" | "red" | "green" | "ink" }) {
  const tones = {
    stone: "bg-stone-100 text-stone-700",
    orange: "bg-orange-100 text-orange-700",
    red: "bg-red-100 text-red-700",
    green: "bg-emerald-100 text-emerald-700",
    ink: "bg-stone-900 text-white",
  };
  return <span className={cx("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tones[tone])}>{children}</span>;
}

/** Collapsible section for secondary inputs — keeps primary screens uncluttered. */
export function Disclosure({ title, hint, children, defaultOpen = false, badge }: { title: string; hint?: string; children: ReactNode; defaultOpen?: boolean; badge?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="rounded-xl border border-stone-200/80 bg-white shadow-soft">
      <button className="flex w-full items-center gap-2 px-4 py-3 text-left" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className="flex-1">
          <span className="block text-sm font-medium text-stone-900">{title}</span>
          {hint && <span className="block text-xs text-stone-500">{hint}</span>}
        </span>
        {badge}
        <ChevronDown size={16} className={cx("text-stone-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id={id} className="border-t border-stone-100 px-4 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-stone-200">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => {
            const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
            if (!d) return;
            const n = (i + d + tabs.length) % tabs.length;
            onChange(tabs[n].id);
            refs.current[n]?.focus();
          }}
          className={cx(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
            value === t.id ? "border-stone-900 font-medium text-stone-950" : "border-transparent text-stone-500 hover:text-stone-800",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/40 backdrop-blur-[2px] p-0 sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-fade-up w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-stone-200 shadow-lift max-h-[90vh] overflow-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h3 className="font-semibold text-stone-950">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 text-sm">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-3 border-t border-stone-100 bg-stone-50/80 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

export function Skeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading">
      <div className="h-8 w-64 bg-stone-200/70 rounded-lg" />
      <div className="h-4 w-96 max-w-full bg-stone-200/70 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-stone-200/60 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-stone-200/60 rounded-xl" />
    </div>
  );
}

export function Stat({ label, value, hint, accent, icon }: { label: string; value: ReactNode; hint?: string; accent?: boolean; icon?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-stone-500">{label}</div>
        {icon && <span className={accent ? "text-orange-600" : "text-stone-400"}>{icon}</span>}
      </div>
      <div className={cx("mt-2 text-[1.75rem] leading-none font-semibold tabular-nums tracking-tight", accent ? "text-orange-600" : "text-stone-950")}>{value}</div>
      {hint && <div className="mt-2 text-[11px] text-stone-500">{hint}</div>}
    </Card>
  );
}

export function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-stone-700 mb-1.5">
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-soft placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-4 focus:ring-stone-100";
