"use client";

import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Label, Modal, cx, inputCls } from "@/components/ui";
import { activeBrand, createBrand, setActiveBrand, useAppState } from "@/lib/store";
import { normalizeHex } from "@/lib/engine/contrast";
import type { Brand } from "@/lib/types";

function lightness(hex: string) {
  const n = normalizeHex(hex) ?? "#000000";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

/** Brand avatar: the first palette colour that isn't near-black or near-white. */
export function brandMark(b: Brand) {
  const bg = b.palette.find((p) => normalizeHex(p.hex) && lightness(p.hex) > 0.15 && lightness(p.hex) < 0.85)?.hex ?? b.palette[0]?.hex ?? "#1C1C1E";
  return { bg, letter: (b.name.trim()[0] ?? "?").toUpperCase() };
}

export function BrandMark({ brand, size = 28 }: { brand: Brand; size?: number }) {
  const m = brandMark(brand);
  return (
    <span className="flex shrink-0 items-center justify-center rounded-md text-[11px] font-semibold text-white" style={{ width: size, height: size, background: m.bg }} aria-hidden>
      {m.letter}
    </span>
  );
}

export function CreateBrandModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useAppState();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState<"starter" | "copy" | "empty">("starter");
  const [palette, setPalette] = useState([
    { name: "Ink", hex: "#111827" },
    { name: "White", hex: "#FFFFFF" },
    { name: "Accent", hex: "#2563EB" },
  ]);
  if (!state) return null;
  const src = activeBrand(state);
  const validPalette = palette.filter((p) => p.name.trim() && normalizeHex(p.hex));
  const canCreate = name.trim().length > 1 && validPalette.length > 0;

  const submit = () => {
    createBrand({ name, description, start, palette: validPalette.map((p) => ({ name: p.name.trim(), hex: normalizeHex(p.hex)! })) });
    onClose();
    setName("");
    setDescription("");
    router.push("/guidelines");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a brand"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canCreate} onClick={submit}>Create brand</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="brand-name">Brand name</Label>
          <input id="brand-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aurora Coffee" autoFocus />
        </div>
        <div>
          <Label htmlFor="brand-desc">Short description (optional)</Label>
          <input id="brand-desc" className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-stone-700">Start with</legend>
          <div className="space-y-1.5">
            {(
              [
                ["starter", "Starter rules (recommended)", "7 common rules, wired to the built-in checks. Edit or import your own later."],
                ["copy", `Copy rules from ${src.name}`, "Rules, facts and terminology are copied. History is not."],
                ["empty", "Empty", "Add rules yourself or import a brand book PDF."],
              ] as const
            ).map(([v, title, hint]) => (
              <label key={v} className={cx("flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2.5", start === v ? "border-stone-900 bg-stone-50" : "border-stone-200")}>
                <input type="radio" name="brand-start" className="mt-1" checked={start === v} onChange={() => setStart(v)} />
                <span>
                  <span className="block text-sm font-medium text-stone-900">{title}</span>
                  <span className="block text-xs text-stone-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-stone-700">Approved colours</span>
            {palette.length < 6 && (
              <button className="text-xs text-orange-700 hover:underline" onClick={() => setPalette([...palette, { name: "", hex: "#" }])}>
                + Add colour
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {palette.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="color"
                  aria-label={`Colour ${i + 1} picker`}
                  className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-stone-200 p-0.5"
                  value={normalizeHex(p.hex) ?? "#000000"}
                  onChange={(e) => setPalette(palette.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)))}
                />
                <input aria-label={`Colour ${i + 1} name`} className={inputCls} value={p.name} placeholder="Name" onChange={(e) => setPalette(palette.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input aria-label={`Colour ${i + 1} hex`} className={cx(inputCls, "w-28 font-mono")} value={p.hex} onChange={(e) => setPalette(palette.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} />
                <button aria-label={`Remove colour ${i + 1}`} className="p-1 text-stone-400 hover:text-red-600" onClick={() => setPalette(palette.filter((_, j) => j !== i))}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-stone-500">Stored in this browser only. You can import a brand book PDF from Guidelines → Rules after creating it.</p>
      </div>
    </Modal>
  );
}

export function BrandSwitcher() {
  const state = useAppState();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  if (!state) return null;
  const brand = activeBrand(state);

  return (
    <div ref={ref} className="relative">
      <button
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Brand: ${brand.name}. Switch brand`}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-stone-200/80 bg-white px-3 py-2 text-left shadow-soft hover:border-stone-300"
      >
        <BrandMark brand={brand} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-stone-900">{brand.name}</span>
          <span className={cx("block text-[11px]", brand.fictional ? "text-orange-700" : "text-stone-500")}>{brand.fictional ? "Fictional demo brand" : `${brand.rules.length} rules`}</span>
        </span>
        <ChevronsUpDown size={14} className="text-stone-400" />
      </button>
      {open && (
        <div className="animate-fade-up absolute left-0 right-0 top-full z-40 mt-1.5 rounded-xl border border-stone-200 bg-white p-1 shadow-lift">
          <ul role="listbox" aria-label="Brands">
            {state.brands.map((b) => (
              <li key={b.id} role="option" aria-selected={b.id === brand.id}>
                <button
                  onClick={() => {
                    setActiveBrand(b.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-stone-100"
                >
                  <BrandMark brand={b} size={22} />
                  <span className="flex-1 truncate">{b.name}</span>
                  {b.id === brand.id && <Check size={14} className="text-orange-600" />}
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-stone-100 px-2.5 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
          >
            <Plus size={14} /> New brand…
          </button>
        </div>
      )}
      <CreateBrandModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
