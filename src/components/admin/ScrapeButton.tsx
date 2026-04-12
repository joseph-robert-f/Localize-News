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
  const [state, setState] = useState<"idle" | "loading" | "queued" | "error">("idle");
  const [actionsUrl, setActionsUrl] = useState("");
  const [error, setError] = useState("");

  async function handleScrape() {
    if (!secret) return;
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/admin/dispatch-scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ townshipId, force: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setActionsUrl(data.actionsUrl);
      setState("queued");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispatch failed.");
      setState("error");
    }
  }

  if (state === "queued") {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-green-600 dark:text-green-400 font-medium">
          ✓ Queued in GitHub Actions
        </span>
        <a
          href={actionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          Watch run →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        loading={state === "loading"}
        disabled={state === "loading"}
        onClick={handleScrape}
        title={`Scrape ${townshipName} via GitHub Actions`}
      >
        Scrape now
      </Button>
      {state === "error" && <p className="text-xs text-red-500 max-w-[180px] text-right">{error}</p>}
    </div>
  );
}
