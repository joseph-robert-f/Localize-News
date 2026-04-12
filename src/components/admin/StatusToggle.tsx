"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAdminSecret } from "./AdminAuth";
import type { TownshipStatus } from "@/lib/db/types";

interface StatusToggleProps {
  townshipId: string;
  currentStatus: TownshipStatus;
}

export function StatusToggle({ townshipId, currentStatus }: StatusToggleProps) {
  const { secret } = useAdminSecret();
  const [status, setStatus] = useState<TownshipStatus>(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function setTo(next: TownshipStatus) {
    if (!secret || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/townships/${townshipId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "active") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          loading={loading}
          disabled={loading}
          onClick={() => setTo("pending")}
          title="Set to pending"
        >
          Deactivate
        </Button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="primary"
        loading={loading}
        disabled={loading}
        onClick={() => setTo("active")}
        title="Activate for scraping"
      >
        Activate
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
