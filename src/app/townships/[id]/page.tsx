import { notFound } from "next/navigation";
import Link from "next/link";
import { getTownshipById } from "@/lib/db/townships";
import { getDocumentsByTownship, getDocumentCounts } from "@/lib/db/documents";
import { DocumentList } from "@/components/township/DocumentList";
import { LoadMore } from "@/components/township/LoadMore";
import { StatusBadge } from "@/components/township/StatusBadge";
import { formatDate } from "@/lib/utils";
import { DOCUMENT_TYPES } from "@/lib/db/types";
import type { DocumentType } from "@/lib/db/types";

export const revalidate = 3600;

export default async function TownshipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type: rawType } = await searchParams;

  const [township] = await Promise.all([getTownshipById(id)]);
  if (!township) notFound();

  const selectedType =
    rawType && (DOCUMENT_TYPES as readonly string[]).includes(rawType)
      ? (rawType as DocumentType)
      : undefined;

  const [{ documents, nextCursor }, counts] = await Promise.all([
    getDocumentsByTownship(id, { type: selectedType }),
    getDocumentCounts(id),
  ]);

  const totalDocs = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            ← All townships
          </Link>
          <StatusBadge status={township.status} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Township info */}
        <section className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {township.name}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {township.state} ·{" "}
                <a
                  href={township.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Official website
                </a>
              </p>
            </div>
            <div className="text-right text-xs text-zinc-400">
              {township.last_scraped_at ? (
                <>Last indexed {formatDate(township.last_scraped_at)}</>
              ) : (
                "Not yet indexed"
              )}
            </div>
          </div>

          {/* Doc count summary */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm text-zinc-500">{totalDocs} documents total</span>
          </div>
        </section>

        {/* Type filter */}
        <nav className="mb-6 flex flex-wrap gap-2">
          <Link
            href={`/townships/${id}`}
            className={
              !selectedType
                ? "rounded-full bg-zinc-900 px-3 py-1 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "rounded-full border border-zinc-300 px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }
          >
            All
          </Link>
          {DOCUMENT_TYPES.map((t) => (
            <Link
              key={t}
              href={`/townships/${id}?type=${t}`}
              className={
                selectedType === t
                  ? "rounded-full bg-zinc-900 px-3 py-1 text-sm font-medium capitalize text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "rounded-full border border-zinc-300 px-3 py-1 text-sm capitalize text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }
            >
              {t}
              {counts[t] > 0 && (
                <span className="ml-1.5 text-xs opacity-60">{counts[t]}</span>
              )}
            </Link>
          ))}
        </nav>

        {/* Documents */}
        <DocumentList
          documents={documents}
          emptyMessage={
            selectedType
              ? `No ${selectedType} documents found for this township.`
              : "No documents indexed yet."
          }
        />
        <LoadMore townshipId={id} type={selectedType} initialCursor={nextCursor} />
      </main>
    </div>
  );
}
