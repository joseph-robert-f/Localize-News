"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAdminSecret } from "./AdminAuth";

/**
 * Triggers POST /api/admin/summarize-batch for all townships.
 * Runs up to `limit` unsummarized documents per click.
 */
export function BatchSummarizeButton() {
  const { secret } = useAdminSecret();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{ processed: number; failed: number } | null>(null);
  const [error, setError] = useState("");

  async function handleRun() {
    if (!secret || state === "loading") return;
    setState("loading");
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/summarize-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ limit: 20 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult({ processed: data.processed, failed: data.failed });
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Button
        size="sm"
        variant="secondary"
        loading={state === "loading"}
        disabled={state === "loading"}
        onClick={handleRun}
      >
        {state === "loading" ? "Summarizing…" : "Summarize unsummarized docs (batch of 20)"}
      </Button>
      {state === "done" && result && (
        <span className="text-xs text-zinc-500">
          {result.processed} summarized · {result.failed} failed
        </span>
      )}
      {state === "error" && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
