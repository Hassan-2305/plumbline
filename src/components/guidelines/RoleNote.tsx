"use client";

import { setRole } from "@/lib/store";
import type { AppState } from "@/lib/types";

/** Explains who can do what on governance screens and offers the role switch. */
export function RoleNote({ role, action = "approve" }: { role: AppState["role"]; action?: string }) {
  if (role === "reviewer") return null;
  return (
    <p className="text-xs text-stone-500">
      Writers can propose changes. Only a reviewer can {action}.{" "}
      <button className="text-accent-700 underline" onClick={() => setRole("reviewer")}>
        Switch to reviewer (simulated)
      </button>
    </p>
  );
}
