"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Township } from "@/lib/db/types";
import { StatusBadge } from "@/components/township/StatusBadge";
import { timeAgo } from "@/lib/utils";

interface QueuePanelProps {
  townships: Township[];
}

export function QueuePanel({ townships }: QueuePanelProps) {
  const router = useRouter();
  const [bumping, setBumping] = useState<string | null>(null);

  async function handleBump(id: string) {
    setBumping(id);
    try {
      const res = await fetch(`/api/admin/townships/${id}/bump`, {
        method: "POST",
        headers: {
          "x-admin-secret": sessionStorage.getItem("adminSecret") ?? "",
        },
      });
      if (!res.ok) {
        console.error("[QueuePanel] bump failed", await res.text());
      } else {
        router.refresh();
      }
    } finally {
      setBumping(null);
    }
  }

  function nextScrapeLabel(t: Township): string {
    if (!t.next_scrape_at) return "Queued now";
    const d = new Date(t.next_scrape_at);
    if (d <= new Date()) return "Queued now";
    return `in ${timeAgo(d).replace(" ago", "").replace("just now", "moments")}`;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <th className="px-4 py-3 text-left font-medium text-zinc-500">Township</th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">Status</th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">Next Scrape</th>
            <th className="px-4 py-3 text-right font-medium text-zinc-500">Empty Runs</th>
            <th className="px-4 py-3 text-right font-medium text-zinc-500"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {townships.map((t) => (
            <tr key={t.id} className="bg-white dark:bg-zinc-900/50">
              <td className="px-4 py-3">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {t.name}, {t.state}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={t.status} />
              </td>
              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                {t.status === "active" ? nextScrapeLabel(t) : "—"}
              </td>
              <td className="px-4 py-3 text-right text-zinc-500">
                {t.consecutive_empty_runs > 0 ? t.consecutive_empty_runs : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                {t.status === "active" && (
                  <button
                    onClick={() => handleBump(t.id)}
                    disabled={bumping === t.id}
                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {bumping === t.id ? "…" : "Bump"}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {townships.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                No townships found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
