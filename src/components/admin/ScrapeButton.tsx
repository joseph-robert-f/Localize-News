"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAdminSecret } from "./AdminAuth";

interface ScrapeButtonProps {
  townshipId: string;
  townshipName: string;
}

export function ScrapeButton({ townshipId, townshipName }: ScrapeButtonProps) {
  const { secret } = useAdminSecret();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{ found: number; inserted: number } | null>(null);
  const [error, setError] = useState("");

  async function handleScrape() {
    if (!secret) return;
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ townshipId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult({ found: data.found, inserted: data.inserted });
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape failed.");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {state === "done" && result && (
        <span className="text-xs text-zinc-500">
          {result.found} found · {result.inserted} new
        </span>
      )}
      <Button
        size="sm"
        variant="secondary"
        loading={state === "loading"}
        disabled={state === "loading" || state === "done"}
        onClick={handleScrape}
        title={`Scrape ${townshipName}`}
      >
        {state === "done" ? "Done" : "Scrape now"}
      </Button>
      {state === "error" && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
