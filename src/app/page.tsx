import Link from "next/link";
import { getActiveTownships } from "@/lib/db/townships";
import { StatusBadge } from "@/components/township/StatusBadge";
import { formatDate } from "@/lib/utils";
import type { Township } from "@/lib/db/types";

export const revalidate = 3600; // ISR: revalidate every hour

async function TownshipRow({ township }: { township: Township }) {
  return (
    <Link
      href={`/townships/${township.id}`}
      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
    >
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {township.name}
        </span>
        <span className="text-sm text-zinc-500">{township.state}</span>
      </div>
      <div className="flex items-center gap-4">
        {township.last_scraped_at && (
          <span className="hidden text-xs text-zinc-400 sm:block">
            Updated {formatDate(township.last_scraped_at)}
          </span>
        )}
        <StatusBadge status={township.status} />
      </div>
    </Link>
  );
}

async function TownshipDirectory() {
  let townships: Township[] = [];
  let error: string | null = null;

  try {
    townships = await getActiveTownships();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load townships.";
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        {error}
      </p>
    );
  }

  if (townships.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">
        No townships indexed yet.{" "}
        <Link href="/request" className="underline hover:text-zinc-800">
          Submit a request
        </Link>{" "}
        to add yours.
      </p>
    );
  }

  // Group by state
  const byState = townships.reduce<Record<string, Township[]>>((acc, t) => {
    (acc[t.state] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-8">
      {Object.entries(byState)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([state, list]) => (
          <section key={state}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              {state}
            </h2>
            <ul className="flex flex-col gap-2">
              {list.map((t) => (
                <li key={t.id}>
                  <TownshipRow township={t} />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

export default function HomePage() {
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
            Townships
          </h2>
          {/* @ts-expect-error async RSC */}
          <TownshipDirectory />
        </section>
      </main>
    </div>
  );
}
