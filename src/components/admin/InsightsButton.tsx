"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAdminSecret } from "./AdminAuth";

interface InsightsButtonProps {
  townshipId: string;
  hasInsights: boolean;
}

export function InsightsButton({ townshipId, hasInsights }: InsightsButtonProps) {
  const { secret } = useAdminSecret();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!secret || state === "loading") return;
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/admin/analyze-area", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ townshipId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        loading={state === "loading"}
        disabled={state === "loading" || state === "done"}
        onClick={handleGenerate}
        title="Generate AI area insights"
      >
        {state === "done" ? "Done" : hasInsights ? "Refresh insights" : "Gen insights"}
      </Button>
      {state === "error" && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
