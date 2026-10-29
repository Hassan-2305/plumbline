"use client";

import { useEffect, useState } from "react";
import type { AiStatusResponse } from "./types";

let cache: AiStatusResponse | null = null;
let inflight: Promise<AiStatusResponse> | null = null;

function fetchStatus(): Promise<AiStatusResponse> {
  inflight ??= fetch("/api/status")
    .then((r) => r.json() as Promise<AiStatusResponse>)
    .catch(() => ({ configured: false, provider: "AI provider", service: "AI provider", model: "", verified: "unchecked" as const, message: "Could not reach the server status endpoint." }))
    .then((s) => (cache = s));
  return inflight;
}

export function useAiStatus() {
  const [status, setStatus] = useState<AiStatusResponse | null>(cache);
  useEffect(() => {
    if (!cache) fetchStatus().then(setStatus);
  }, []);
  return status;
}
