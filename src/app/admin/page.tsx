/**
 * Admin dashboard.
 *
 * This is a Server Component that fetches data; interactive actions
 * (approve/reject, scrape trigger) are handled by Client Components
 * inside AdminAuthProvider, which gates access behind a session-stored secret.
 *
 * Route: /admin
 */

import Link from "next/link";
import { getAllTownships } from "@/lib/db/townships";
import { getPendingRequests } from "@/lib/db/scrapeRequests";
import { getRecentScrapeRuns } from "@/lib/db/scrapeRuns";
import { StatusBadge } from "@/components/township/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatDate, timeAgo } from "@/lib/utils";
import { AdminAuthProvider } from "@/components/admin/AdminAuth";
import { RequestActions } from "@/components/admin/RequestActions";
import { ScrapeButton } from "@/components/admin/ScrapeButton";
import { StatusToggle } from "@/components/admin/StatusToggle";
import { InsightsButton } from "@/components/admin/InsightsButton";
import { BatchSummarizeButton } from "@/components/admin/BatchSummarizeButton";
import { RevalidateButton } from "@/components/admin/RevalidateButton";
import { QueuePanel } from "@/components/admin/QueuePanel";
import type { ScrapeRun, Township, ScrapeRequest } from "@/lib/db/types";

export const dynamic = "force-dynamic"; // always fetch fresh data

export default async function AdminPage() {
  const [townships, pendingRequests, recentRuns] = await Promise.all([
    getAllTownships().catch(() => [] as Township[]),
    getPendingRequests().catch(() => [] as ScrapeRequest[]),
    getRecentScrapeRuns(20).catch(() => [] as ScrapeRun[]),
  ]);

  const active = townships.filter((t) => t.status === "active").length;
  const pending = townships.filter((t) => t.status === "pending").length;
  const errors = townships.filter((t) => t.status === "error").length;

  return (
    <AdminAuthProvider>
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
              { label: "Total", value: townships.length },
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

          {/* AI batch actions */}
          <section className="mb-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">
              AI Actions
            </h2>
            <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-3 text-xs text-zinc-500">
                For townships that were scraped before AI features were added, run this to backfill summaries.
                Click multiple times to process more batches.
              </p>
              <BatchSummarizeButton />
            </div>
          </section>

          {/* Pending requests */}
          {pendingRequests.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">
                Pending Requests ({pendingRequests.length})
              </h2>
              <div className="flex flex-col gap-2">
                {pendingRequests.map((req) => (
                  <PendingRequestRow key={req.id} req={req} />
                ))}
              </div>
            </section>
          )}

          {/* All townships */}
          <section className="mb-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">
              Townships
            </h2>
            <div className="flex flex-col gap-2">
              {townships.map((t) => (
                <TownshipRow key={t.id} township={t} />
              ))}
            </div>
          </section>

          {/* Scrape queue */}
          <section className="mb-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">
              Scrape Queue
            </h2>
            <QueuePanel townships={townships} />
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
    </AdminAuthProvider>
  );
}

function PendingRequestRow({ req }: { req: ScrapeRequest }) {
  return (
    <Card className="flex items-start justify-between gap-6 px-5 py-4">
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{req.township_name}</span>
        <a
          href={req.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          {req.website_url}
        </a>
        {req.contact_email && (
          <span className="text-xs text-zinc-500">{req.contact_email}</span>
        )}
        {req.notes && (
          <span className="text-xs italic text-zinc-400">{req.notes}</span>
        )}
        <span className="text-xs text-zinc-400">{formatDate(req.created_at)}</span>
      </div>
      <RequestActions requestId={req.id} />
    </Card>
  );
}

function TownshipRow({ township }: { township: Township }) {
  return (
    <Card className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {township.name}, {township.state}
        </span>
        <a
          href={township.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          {township.website_url}
        </a>
        {township.last_scraped_at && (
          <span className="text-xs text-zinc-400">
            Last scraped {timeAgo(township.last_scraped_at)}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge status={township.status} />
        <StatusToggle townshipId={township.id} currentStatus={township.status} />
        {township.status === "active" && (
          <ScrapeButton townshipId={township.id} townshipName={township.name} />
        )}
        {township.status === "active" && (
          <InsightsButton townshipId={township.id} hasInsights={!!township.ai_insights} />
        )}
        {township.status === "active" && (
          <RevalidateButton townshipId={township.id} />
        )}
      </div>
    </Card>
  );
}

function ScrapeRunRow({ run }: { run: ScrapeRun }) {
  const variant =
    run.status === "success" ? "success" : run.status === "error" ? "error" : "warning";
  return (
    <Card className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Badge variant={variant}>{run.status}</Badge>
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
