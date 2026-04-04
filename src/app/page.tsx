import Link from "next/link";
import { getActiveTownships } from "@/lib/db/townships";
import { TownshipSearch } from "@/components/township/TownshipSearch";
import type { Township } from "@/lib/db/types";

export const revalidate = 3600; // ISR: revalidate every hour

export default async function HomePage() {
  let townships: Township[] = [];
  let fetchError: string | null = null;

  try {
    townships = await getActiveTownships();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load townships.";
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Localize News
            </span>
            <p className="text-xs text-zinc-500">Township public records, indexed</p>
          </div>
          <Link
            href="/request"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Request a township
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* Hero */}
        <section className="mb-10">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Local government, made searchable.
          </h1>
          <p className="max-w-xl text-zinc-600 dark:text-zinc-400">
            We scrape and index agendas, meeting minutes, budgets, and public proposals
            from township websites so you don&apos;t have to dig through PDFs.
          </p>
        </section>

        {/* Township directory */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Townships {townships.length > 0 && `(${townships.length})`}
          </h2>

          {fetchError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {fetchError}
            </p>
          ) : townships.length === 0 ? (
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
