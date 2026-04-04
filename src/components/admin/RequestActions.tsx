"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAdminSecret } from "./AdminAuth";

interface RequestActionsProps {
  requestId: string;
  onDone?: (status: "approved" | "rejected") => void;
}

export function RequestActions({ requestId, onDone }: RequestActionsProps) {
  const { secret } = useAdminSecret();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState("");

  async function handleAction(status: "approved" | "rejected") {
    if (!secret) return;
    setLoading(status === "approved" ? "approve" : "reject");
    setError("");
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setDone(status);
      onDone?.(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  if (done) {
    return (
      <span className="text-xs font-medium text-zinc-400 capitalize">{done}</span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="primary"
          loading={loading === "approve"}
          disabled={loading !== null}
          onClick={() => handleAction("approved")}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="danger"
          loading={loading === "reject"}
          disabled={loading !== null}
          onClick={() => handleAction("rejected")}
        >
          Reject
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
