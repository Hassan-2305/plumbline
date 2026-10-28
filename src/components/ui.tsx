"use client";

import { ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ContentStatus, FindingSource, FindingStatus, Severity, Verification } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "dark";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent-600 text-white hover:bg-accent-700 border border-accent-600 shadow-[0_1px_2px_rgb(234_88_12/0.25)]",
  accent: "bg-accent-600 text-white hover:bg-accent-700 border border-accent-600 shadow-[0_1px_2px_rgb(234_88_12/0.25)]",
  dark: "bg-stone-900 text-white hover:bg-stone-800 border border-stone-900",
  secondary: "bg-white text-stone-800 border border-stone-200 hover:border-stone-300 hover:bg-stone-50 shadow-soft",
  ghost: "text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-transparent",
  danger: "bg-white text-red-700 border border-stone-300 hover:border-red-300 hover:bg-red-50",
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
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap",
        size === "sm" ? "h-8 px-3 text-xs" : size === "lg" ? "h-11 px-5 text-sm" : "h-9 px-3.5 text-[13px]",
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
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      href={href}
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-150 whitespace-nowrap",
        size === "sm" ? "h-8 px-3 text-xs" : size === "lg" ? "h-11 px-5 text-sm" : "h-9 px-3.5 text-[13px]",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

type Tone = "neutral" | "accent" | "amber" | "red" | "green" | "dark" | "outline";
export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-stone-100 text-stone-700",
    accent: "bg-accent-50 text-accent-700",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
    green: "bg-emerald-50 text-emerald-700",
    dark: "bg-stone-900 text-white",
    outline: "bg-white text-stone-600 ring-1 ring-inset ring-stone-200",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded px-1.5 py-px text-[11px] font-medium leading-4 whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

export const SEVERITY_DOT: Record<Severity, string> = { high: "bg-red-600", medium: "bg-amber-500", low: "bg-stone-400" };

export function SeverityBadge({ s }: { s: Severity }) {
  const text = { high: "text-red-700", medium: "text-amber-700", low: "text-stone-500" }[s];
  return (
    <span className={cx("inline-flex items-center gap-1 text-[11px] font-medium capitalize", text)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", SEVERITY_DOT[s])} aria-hidden />
      {s}
    </span>
  );
}

export function SourceBadge({ source, verification }: { source: FindingSource; verification: Verification }) {
  if (verification === "unverified") return <Badge tone="amber">Unverified</Badge>;
  if (source === "deterministic") return <Badge>Rule-based</Badge>;
  if (source === "ai") return <Badge tone="accent">AI-assisted</Badge>;
  return <Badge tone="outline">Seeded demo</Badge>;
}

export const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  ready_for_approval: "Ready for approval",
  approved: "Approved",
};

export const STATUS_DOT: Record<ContentStatus, string> = {
  draft: "bg-stone-400",
  in_review: "bg-rose-500",
  changes_requested: "bg-amber-500",
  ready_for_approval: "bg-violet-500",
  approved: "bg-emerald-500",
};

const STATUS_PILL: Record<ContentStatus, string> = {
  draft: "bg-stone-100 text-stone-600 ring-stone-200",
  in_review: "bg-rose-50 text-rose-700 ring-rose-200",
  changes_requested: "bg-amber-50 text-amber-800 ring-amber-200",
  ready_for_approval: "bg-violet-50 text-violet-700 ring-violet-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function StatusBadge({ status, className }: { status: ContentStatus; className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap", STATUS_PILL[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  const map = {
    open: ["Open", "outline"],
    accepted: ["Fix accepted", "green"],
    edited: ["Fix edited", "green"],
    dismissed: ["Dismissed", "neutral"],
    escalated: ["Escalated", "amber"],
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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1">{eyebrow}</div>}
        <h1 className="font-serif text-[32px] leading-tight tracking-tight text-stone-950">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside, id }: { children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="font-serif text-[22px] leading-tight text-stone-950">{children}</h2>
      {aside}
    </div>
  );
}

export function IconChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "amber" | "red" | "green" | "ink" | "stone" }) {
  const tones = {
    neutral: "bg-stone-100 text-stone-600",
    stone: "bg-stone-100 text-stone-600",
    accent: "bg-accent-50 text-accent-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    green: "bg-emerald-50 text-emerald-700",
    ink: "bg-stone-900 text-white",
  };
  return <span className={cx("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md", tones[tone])}>{children}</span>;
}

/** Collapsible group for secondary inputs. */
export function Disclosure({ title, hint, children, defaultOpen = false, badge }: { title: string; hint?: string; children: ReactNode; defaultOpen?: boolean; badge?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="border-t border-stone-200">
      <button className="flex w-full items-center gap-2 py-3 text-left" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className="flex-1">
          <span className="block text-[13px] font-medium text-stone-900">{title}</span>
          {hint && <span className="block text-xs text-stone-500">{hint}</span>}
        </span>
        {badge}
        <ChevronDown size={15} className={cx("text-stone-400 transition-transform duration-150", open && "rotate-180")} />
      </button>
      {open && (
        <div id={id} className="animate-fade-up pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label, className }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void; label: string; className?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" aria-label={label} className={cx("flex gap-4 overflow-x-auto border-b border-stone-200", className)}>
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
            "-mb-px whitespace-nowrap border-b-2 py-2 text-[13px] transition-colors duration-150",
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/30 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-fade-up max-h-[90vh] w-full overflow-auto rounded-t-lg border border-stone-200 bg-white shadow-lift sm:max-w-lg sm:rounded-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-stone-950">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 text-[13px]">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-stone-200 bg-stone-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Skeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-label="Loading">
      <div className="h-5 w-48 rounded bg-stone-100" />
      <div className="h-3 w-80 max-w-full rounded bg-stone-100" />
      <div className="h-40 rounded-lg bg-stone-100" />
    </div>
  );
}

export function Stat({ label, value, hint, accent, icon }: { label: string; value: ReactNode; hint?: string; accent?: boolean; icon?: ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-stone-500">
        {icon && <span className="text-stone-400">{icon}</span>}
        {label}
      </div>
      <div className={cx("mt-1 text-xl font-semibold tabular-nums", accent ? "text-red-700" : "text-stone-950")}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-stone-500">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm font-medium text-stone-900">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-[13px] text-stone-500">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/** "3m ago", "2h ago", "22 Oct" */
export function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  if (isNaN(d)) return iso;
  const m = Math.round(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-stone-700">
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-[13px] text-stone-900 placeholder:text-stone-400 transition-colors focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100";
