import type { Metadata } from "next";
import Link from "next/link";
import { searchDocumentsWithTownship } from "@/lib/db/documents";
import { DocumentCard } from "@/components/township/DocumentCard";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { DOCUMENT_TYPES } from "@/lib/db/types";
import type { DocumentType } from "@/lib/db/types";
import type { DocumentWithTownship } from "@/lib/db/documents";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  if (!query) {
    return {
      title: "Search Public Records",
      description:
        "Search agendas, meeting minutes, budgets, and proposals across local governments.",
    };
  }
  return {
    title: `"${query}" — Search`,
    description: `Search results for "${query}" in local government public records.`,
  };
}

const DATE_OPTIONS = [
  { label: "All time", days: undefined },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
] as const;

function buildHref(q: string, type?: string, days?: number): string {
  const params = new URLSearchParams({ q });
  if (type) params.set("type", type);
  if (days) params.set("days", String(days));
  return `/search?${params.toString()}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; days?: string }>;
}) {
  const { q: rawQ, type: rawType, days: rawDays } = await searchParams;
  const query = rawQ?.trim() ?? "";
  const selectedType =
    rawType && (DOCUMENT_TYPES as readonly string[]).includes(rawType)
      ? (rawType as DocumentType)
      : undefined;
  const selectedDays =
    rawDays && ["30", "90", "365"].includes(rawDays)
      ? Number(rawDays)
      : undefined;

  let results: DocumentWithTownship[] = [];
  let fetchError: string | null = null;

  if (query.length >= 2) {
    try {
      results = await searchDocumentsWithTownship(query, {
        type: selectedType,
        limit: 30,
        days: selectedDays,
      });
    } catch (err) {
      fetchError = err instanceof Error ? err.message : "Search failed.";
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <SiteHeader
        slim
        rightSlot={
          <Link
            href="/request"
            className="text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
          >
            Request a township
          </Link>
        }
      />

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Search bar */}
        <form method="GET" action="/search" className="mb-8">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone-400">
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
                className="w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-9 pr-4 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-amber-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-800 dark:bg-amber-100 dark:text-amber-950 dark:hover:bg-amber-200"
            >
              Search
            </button>
          </div>
        </form>

        {/* Type + date filter pills */}
        {query.length >= 2 && (
          <div className="mb-6 flex flex-col gap-2">
            <nav className="flex flex-wrap gap-2">
              <Link
                href={buildHref(query, undefined, selectedDays)}
                className={
                  !selectedType
                    ? "rounded-full bg-stone-900 px-3 py-1 text-sm font-medium text-white dark:bg-stone-100 dark:text-stone-900"
                    : "rounded-full border border-stone-300 px-3 py-1 text-sm text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
                }
              >
                All types
              </Link>
              {DOCUMENT_TYPES.map((t) => (
                <Link
                  key={t}
                  href={buildHref(query, t, selectedDays)}
                  className={
                    selectedType === t
                      ? "rounded-full bg-stone-900 px-3 py-1 text-sm font-medium capitalize text-white dark:bg-stone-100 dark:text-stone-900"
                      : "rounded-full border border-stone-300 px-3 py-1 text-sm capitalize text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
                  }
                >
                  {t}
                </Link>
              ))}
            </nav>
            <nav className="flex flex-wrap gap-2">
              {DATE_OPTIONS.map(({ label, days }) => (
                <Link
                  key={label}
                  href={buildHref(query, selectedType, days)}
                  className={
                    selectedDays === days
                      ? "rounded-full bg-stone-700 px-3 py-1 text-sm font-medium text-white dark:bg-stone-300 dark:text-stone-900"
                      : "rounded-full border border-stone-200 px-3 py-1 text-sm text-stone-500 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
                  }
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        )}

        {/* Results */}
        {fetchError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {fetchError}
          </p>
        ) : query.length < 2 ? (
          <div className="py-16 text-center">
            <p className="text-stone-400">Enter at least 2 characters to search.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-stone-500">
              No documents found for <strong>&ldquo;{query}&rdquo;</strong>.
            </p>
            <p className="mt-2 text-sm text-stone-400">
              Try a broader term or{" "}
              <Link href="/" className="underline hover:text-stone-700">
                browse townships
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-stone-500">
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
