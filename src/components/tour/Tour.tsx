"use client";

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createFromExample, useAppState } from "@/lib/store";
import { cx } from "../ui";
import { TOUR_STEPS } from "./steps";

// Accessible spotlight walkthrough: a modal dialog anchored to a highlighted
// element. Keyboard: ←/→ to move, Esc to close. Focus stays inside the card.

const SEEN_KEY = "plumbline-jury:tour";
const DEMO_KEY = "plumbline-jury:tour-demo";

interface TourCtx {
  start: () => void;
  active: boolean;
}
const Ctx = createContext<TourCtx>({ start: () => {}, active: false });
export const useTour = () => useContext(Ctx);

function safeGet(store: Storage | undefined, k: string) {
  try {
    return store?.getItem(k) ?? null;
  } catch {
    return null;
  }
}
function safeSet(store: Storage | undefined, k: string, v: string) {
  try {
    store?.setItem(k, v);
  } catch {
    /* storage blocked — tour still works for this session */
  }
}

type Rect = { top: number; left: number; width: number; height: number };

export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const state = useAppState();
  const [index, setIndex] = useState<number | null>(null);
  // Where the current step's target is; only trusted when it belongs to the current step.
  const [loc, setLoc] = useState<{ idx: number; rect: Rect | null } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const autoStarted = useRef(false);

  const step = index !== null ? TOUR_STEPS[index] : null;
  const ready = loc !== null && loc.idx === index;
  const rect = ready ? loc.rect : null;

  const demoRoute = useCallback(() => {
    const ss = typeof window !== "undefined" ? window.sessionStorage : undefined;
    let id = safeGet(ss, DEMO_KEY);
    if (!id || !state?.items.some((i) => i.id === id)) {
      id = createFromExample("A");
      safeSet(ss, DEMO_KEY, id);
    }
    return `/content/${id}`;
  }, [state]);

  const close = useCallback((completed: boolean) => {
    safeSet(typeof window !== "undefined" ? window.localStorage : undefined, SEEN_KEY, completed ? "done" : "dismissed");
    setIndex(null);
    setLoc(null);
  }, []);

  const start = useCallback(() => setIndex(0), []);

  // First visit: open the welcome step once the app state has loaded.
  useEffect(() => {
    if (!state || autoStarted.current) return;
    autoStarted.current = true;
    if (path !== "/" || safeGet(window.localStorage, SEEN_KEY)) return;
    const t = setTimeout(() => setIndex(0), 300);
    return () => clearTimeout(t);
  }, [state, path]);

  // Navigate to the step's route.
  useEffect(() => {
    if (!step?.route) return;
    const target = step.route === "demo" ? demoRoute() : step.route;
    if (path !== target) router.push(target);
    // demoRoute identity changes with state; navigation only needs the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Locate the target (it may render after navigation) and track its position.
  useLayoutEffect(() => {
    if (!step || index === null) return;
    const idx = index;
    let raf = 0;
    if (!step.target) {
      raf = window.setTimeout(() => setLoc({ idx, rect: null }), 0);
      return () => clearTimeout(raf);
    }
    let tries = 0;
    let el: HTMLElement | null = null;
    const measure = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      setLoc({ idx, rect: { top: r.top, left: r.left, width: r.width, height: r.height } });
    };
    const find = () => {
      // The same target can exist in desktop and mobile layouts; use the visible one.
      el = [...document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`)].find((x) => x.getBoundingClientRect().width > 0) ?? null;
      const visible = !!el;
      if (visible) {
        const r = el!.getBoundingClientRect();
        // Only scroll when needed; scrolling sticky elements can shift the page.
        if (window.innerWidth < 640) {
          // Keep the target above the bottom sheet and below the sticky header.
          if (r.top < 140 || r.top > window.innerHeight - 320) window.scrollBy(0, r.top - 140);
        } else if (r.top < 0 || r.bottom > window.innerHeight) {
          el!.scrollIntoView({ block: "center", behavior: "auto" });
        }
        measure();
      } else if (tries++ < 60) {
        raf = window.setTimeout(find, 50);
      } else {
        setLoc({ idx, rect: null }); // fall back to a centred card
      }
    };
    raf = window.setTimeout(find, 0);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, index, path]);

  // Focus the primary action whenever the step changes.
  useEffect(() => {
    if (ready) primaryRef.current?.focus({ preventScroll: true });
  }, [ready, index]);

  const next = useCallback(() => {
    if (index === null) return;
    if (index >= TOUR_STEPS.length - 1) close(true);
    else setIndex(index + 1);
  }, [index, close]);
  const back = useCallback(() => setIndex((i) => (i && i > 0 ? i - 1 : i)), []);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
      else if (e.key === "Tab" && cardRef.current) {
        const f = cardRef.current.querySelectorAll<HTMLElement>("button");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, next, back, close]);

  const total = TOUR_STEPS.length;
  const pad = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardW = Math.min(360, vw - 32);
  let cardStyle: React.CSSProperties = { left: (vw - cardW) / 2, top: vh / 2 - 120, width: cardW };
  if (vw < 640) {
    // Phones: a bottom sheet is easier to read than a floating card.
    cardStyle = { left: 12, width: vw - 24, bottom: 12 };
  } else if (rect) {
    const cardH = 250;
    const below = rect.top + rect.height + pad + 12;
    const above = rect.top - pad - 12 - cardH;
    const clampTop = (t: number) => Math.min(Math.max(16, t), vh - cardH - 16);
    const clampLeft = (l: number) => Math.min(Math.max(16, l), vw - cardW - 16);
    if (below + cardH < vh) {
      cardStyle = { top: below, left: clampLeft(rect.left + rect.width / 2 - cardW / 2), width: cardW };
    } else if (above > 16) {
      cardStyle = { top: above, left: clampLeft(rect.left + rect.width / 2 - cardW / 2), width: cardW };
    } else if (rect.left + rect.width + pad + cardW + 28 < vw) {
      // Tall or bottom-anchored targets (e.g. the sidebar): place the card beside them.
      cardStyle = { top: clampTop(rect.top + rect.height / 2 - cardH / 2), left: rect.left + rect.width + pad + 16, width: cardW };
    } else {
      cardStyle = { top: clampTop(vh - cardH - 16), left: clampLeft(rect.left + rect.width / 2 - cardW / 2), width: cardW };
    }
  }

  return (
    <Ctx.Provider value={{ start, active: index !== null }}>
      {children}
      {step && ready && (
        <div className="fixed inset-0 z-[60]" aria-hidden={false}>
          {/* Dim layer with a cut-out around the target */}
          {rect ? (
            <div
              aria-hidden
              className="pointer-events-none fixed rounded-lg ring-2 ring-accent-500 transition-all duration-200"
              style={{
                top: rect.top - pad,
                left: rect.left - pad,
                width: rect.width + pad * 2,
                height: rect.height + pad * 2,
                boxShadow: "0 0 0 9999px rgb(10 10 10 / 0.45)",
              }}
            >
            </div>
          ) : (
            <div aria-hidden className="fixed inset-0 bg-stone-950/55 backdrop-blur-[1px]" />
          )}
          {/* Block interaction with the page while touring */}
          <div className="fixed inset-0" />

          <div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            aria-describedby="tour-body"
            className="animate-fade-up fixed rounded-xl border border-stone-200 bg-white p-5 shadow-lift"
            style={cardStyle}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-[11px] font-medium text-stone-500">
                  Step {index! + 1} of {total}
                </div>
                <h2 id="tour-title" className="mt-0.5 text-[15px] font-semibold leading-snug text-stone-950">
                  {step.title}
                </h2>
              </div>
              <button onClick={() => close(false)} aria-label="Close tour" className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-900">
                <X size={16} />
              </button>
            </div>
            <p id="tour-body" className="mt-2 text-sm leading-relaxed text-stone-600">
              {step.body}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex gap-1" aria-hidden>
                {TOUR_STEPS.map((s, i) => (
                  <span key={s.id} className={cx("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-stone-900" : i < index! ? "w-1.5 bg-stone-400" : "w-1.5 bg-stone-200")} />
                ))}
              </div>
              <div className="ml-auto flex gap-1.5">
                {index! > 0 ? (
                  <button onClick={back} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-stone-600 hover:bg-stone-100">
                    <ArrowLeft size={13} /> Back
                  </button>
                ) : (
                  <button onClick={() => close(false)} className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-stone-600 hover:bg-stone-100">
                    Skip
                  </button>
                )}
                <button
                  ref={primaryRef}
                  onClick={next}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-stone-900 px-3 text-xs font-medium text-white hover:bg-stone-800"
                >
                  {index === 0 ? "Start tour" : index === total - 1 ? "Finish" : "Next"} {index! < total - 1 && <ArrowRight size={13} />}
                </button>
              </div>
            </div>
            <p className="sr-only" aria-live="polite">
              Step {index! + 1} of {total}: {step.title}
            </p>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
