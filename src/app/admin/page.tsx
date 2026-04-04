/**
 * Admin dashboard — server component.
 * Gated by ADMIN_SECRET query param for now (placeholder until proper auth).
 *
 * Routes:
 *   /admin?secret=<ADMIN_SECRET>
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { getAllTownships } from "@/lib/db/townships";
import { getPendingRequests } from "@/lib/db/scrapeRequests";
import { getRecentScrapeRuns } from "@/lib/db/scrapeRuns";
import { StatusBadge } from "@/components/township/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatDate, timeAgo } from "@/lib/utils";
import type { ScrapeRun } from "@/lib/db/types";

// Admin page is a Server Component — access the secret from searchParams
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string }>;
}) {
  const { secret } = await searchParams;
  if (secret !== process.env.ADMIN_SECRET) {
    redirect("/");
  }

  const [townships, pendingRequests, recentRuns] = await Promise.all([
    getAllTownships().catch(() => []),
    getPendingRequests().catch(() => []),
    getRecentScrapeRuns(20).catch(() => []),
  ]);

  const active = townships.filter((t) => t.status === "active").length;
  const pending = townships.filter((t) => t.status === "pending").length;
  const errors = townships.filter((t) => t.status === "error").length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              ← Home
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Admin</span>
          </div>
          <Badge variant="warning">Internal</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Stats row */}
        <section className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Townships", value: townships.length },
            { label: "Active", value: active },
            { label: "Pending", value: pending },
            { label: "Errors", value: errors },
          ].map(({ label, value }) => (
            <Card key={label} className="flex flex-col items-center justify-center py-6">
              <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{value}</span>
              <span className="mt-1 text-xs text-zinc-500">{label}</span>
            </Card>
          ))}
        </section>

        {/* Pending requests */}
        {pendingRequests.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">
              Pending Requests ({pendingRequests.length})
            </h2>
            <div className="flex flex-col gap-2">
              {pendingRequests.map((req) => (
                <Card key={req.id} className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {req.township_name}
                    </span>
                    <a
                      href={req.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {req.website_url}
                    </a>
                    {req.contact_email && (
                      <span className="text-xs text-zinc-500">{req.contact_email}</span>
                    )}
                    {req.notes && (
                      <span className="text-xs text-zinc-400 italic">{req.notes}</span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {formatDate(req.created_at)}
                  </span>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* All townships */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">
            All Townships
          </h2>
          <div className="flex flex-col gap-2">
            {townships.map((t) => (
              <Card key={t.id} className="flex items-center justify-between gap-4 py-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {t.name}, {t.state}
                  </span>
                  <a
                    href={t.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {t.website_url}
                  </a>
                </div>
                <div className="flex items-center gap-4">
                  {t.last_scraped_at && (
                    <span className="hidden text-xs text-zinc-400 sm:block">
                      {timeAgo(t.last_scraped_at)}
                    </span>
                  )}
                  <StatusBadge status={t.status} />
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Recent scrape runs */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Recent Scrape Runs
          </h2>
          <div className="flex flex-col gap-2">
            {recentRuns.length === 0 && (
              <p className="text-sm text-zinc-500">No runs recorded yet.</p>
            )}
            {recentRuns.map((run) => (
              <ScrapeRunRow key={run.id} run={run} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function ScrapeRunRow({ run }: { run: ScrapeRun }) {
  const statusVariant =
    run.status === "success" ? "success" : run.status === "error" ? "error" : "warning";
  return (
    <Card className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        <Badge variant={statusVariant}>{run.status}</Badge>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {run.triggered_by} — {run.documents_found} found, {run.documents_inserted} inserted
        </span>
        {run.error_message && (
          <span className="max-w-xs truncate text-xs text-red-500">{run.error_message}</span>
        )}
      </div>
      <span className="shrink-0 text-xs text-zinc-400">{timeAgo(run.started_at)}</span>
    </Card>
  );
}
