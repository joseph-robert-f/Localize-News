"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAdminSecret } from "./AdminAuth";

interface RevalidateButtonProps {
  townshipId: string;
}

export function RevalidateButton({ townshipId }: RevalidateButtonProps) {
  const { secret } = useAdminSecret();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleRevalidate() {
    if (!secret || state === "loading") return;
    setState("loading");
    try {
      const res = await fetch("/api/admin/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ townshipId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      loading={state === "loading"}
      disabled={state === "loading"}
      onClick={handleRevalidate}
      title="Flush page cache so latest data shows immediately"
    >
      {state === "done" ? "✓ Flushed" : state === "error" ? "Failed" : "Flush cache"}
    </Button>
  );
}
