import Link from "next/link";
import { getActiveTownships } from "@/lib/db/townships";
import { getTotalDocumentCount } from "@/lib/db/documents";
import { TownshipSearch } from "@/components/township/TownshipSearch";
import { RecentlyUpdated } from "@/components/home/RecentlyUpdated";
import type { Township } from "@/lib/db/types";

export const revalidate = 3600;

export default async function HomePage() {
  let townships: Township[] = [];
  let totalDocs = 0;

  try {
    [townships, totalDocs] = await Promise.all([
      getActiveTownships(),
      getTotalDocumentCount(),
    ]);
  } catch {
    // render with empty state on error
  }

  const stateCount = new Set(townships.map((t) => t.state)).size;
  const recentlyUpdated = [...townships]
    .filter((t) => t.last_scraped_at)
    .sort((a, b) =>
      new Date(b.last_scraped_at!).getTime() - new Date(a.last_scraped_at!).getTime()
    )
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Localize News
            </span>
            <p className="text-xs text-zinc-500">Township public records, indexed</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/search"
              className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Search docs
            </Link>
            <Link
              href="/request"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Request a township
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-12">
        {/* Hero */}
        <section>
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Local government,<br />made searchable.
          </h1>
          <p className="max-w-lg text-zinc-600 dark:text-zinc-400 mb-6">
            We index agendas, minutes, budgets, and public proposals from township
            websites so you can search across all of them in one place.
          </p>
          {/* Inline search CTA */}
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            Search all documents
          </Link>
        </section>

        {/* Stats bar */}
        {townships.length > 0 && (
          <section className="grid grid-cols-3 gap-4">
            {[
              { value: townships.length, label: "Active townships" },
              { value: totalDocs.toLocaleString(), label: "Documents indexed" },
              { value: stateCount, label: stateCount === 1 ? "State covered" : "States covered" },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
              </div>
            ))}
          </section>
        )}

        {/* Recently updated */}
        {recentlyUpdated.length > 0 && (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">
              Recently indexed
            </h2>
            <RecentlyUpdated townships={recentlyUpdated} />
          </section>
        )}

        {/* Full directory */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">
            All townships {townships.length > 0 && `· ${townships.length}`}
          </h2>

          {townships.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              No townships indexed yet.{" "}
              <Link href="/request" className="underline hover:text-zinc-800">
                Submit a request
              </Link>{" "}
              to add yours.
            </p>
          ) : (
            <TownshipSearch townships={townships} />
          )}
        </section>
      </main>
    </div>
  );
}
