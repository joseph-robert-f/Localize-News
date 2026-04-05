import Link from "next/link";
import { searchDocumentsWithTownship } from "@/lib/db/documents";
import { DocumentCard } from "@/components/township/DocumentCard";
import type { DocumentType } from "@/lib/db/types";
import type { DocumentWithTownship } from "@/lib/db/documents";

const DOC_TYPES: DocumentType[] = ["agenda", "minutes", "budget", "proposal", "other"];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q: rawQ, type: rawType } = await searchParams;
  const query = rawQ?.trim() ?? "";
  const selectedType =
    rawType && DOC_TYPES.includes(rawType as DocumentType)
      ? (rawType as DocumentType)
      : undefined;

  let results: DocumentWithTownship[] = [];
  let fetchError: string | null = null;

  if (query.length >= 2) {
    try {
      results = await searchDocumentsWithTownship(query, { type: selectedType, limit: 30 });
    } catch (err) {
      fetchError = err instanceof Error ? err.message : "Search failed.";
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            Localize News
          </Link>
          <Link
            href="/request"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Request a township
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Search bar */}
        <form method="GET" action="/search" className="mb-8">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              </span>
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search documents across all townships…"
                autoFocus={!query}
                className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Search
            </button>
          </div>
        </form>

        {/* Type filter pills */}
        {query.length >= 2 && (
          <nav className="mb-6 flex flex-wrap gap-2">
            <Link
              href={`/search?q=${encodeURIComponent(query)}`}
              className={
                !selectedType
                  ? "rounded-full bg-zinc-900 px-3 py-1 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "rounded-full border border-zinc-300 px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }
            >
              All types
            </Link>
            {DOC_TYPES.map((t) => (
              <Link
                key={t}
                href={`/search?q=${encodeURIComponent(query)}&type=${t}`}
                className={
                  selectedType === t
                    ? "rounded-full bg-zinc-900 px-3 py-1 text-sm font-medium capitalize text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "rounded-full border border-zinc-300 px-3 py-1 text-sm capitalize text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }
              >
                {t}
              </Link>
            ))}
          </nav>
        )}

        {/* Results */}
        {fetchError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {fetchError}
          </p>
        ) : query.length < 2 ? (
          <div className="py-16 text-center">
            <p className="text-zinc-400">Enter at least 2 characters to search.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-zinc-500">
              No documents found for <strong>&ldquo;{query}&rdquo;</strong>.
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Try a broader term or{" "}
              <Link href="/" className="underline hover:text-zinc-700">
                browse townships
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-zinc-500">
              {results.length} result{results.length !== 1 ? "s" : ""} for{" "}
              <strong>&ldquo;{query}&rdquo;</strong>
              {selectedType && ` · ${selectedType}`}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((doc) => (
                <li key={doc.id}>
                  <DocumentCard
                    doc={doc}
                    townshipName={doc.township_name}
                    townshipState={doc.township_state}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
