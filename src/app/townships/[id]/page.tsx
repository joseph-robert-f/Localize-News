import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTownshipById } from "@/lib/db/townships";
import {
  getDocumentsByTownship,
  getDocumentCounts,
  getDocumentMonthCounts,
  getMostRecentByType,
  getRecentSummaries,
  getTopTopics,
} from "@/lib/db/documents";
import { DocumentList } from "@/components/township/DocumentList";
import { LoadMore } from "@/components/township/LoadMore";
import { StatusBadge } from "@/components/township/StatusBadge";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { DocumentTimeline } from "@/components/township/DocumentTimeline";
import { TypeBreakdown } from "@/components/township/TypeBreakdown";
import { RecentByType } from "@/components/township/RecentByType";
import { MeetingDigest } from "@/components/township/MeetingDigest";
import { AreaInsightsCard } from "@/components/township/AreaInsightsCard";
import { formatDate } from "@/lib/utils";
import { DOCUMENT_TYPES } from "@/lib/db/types";
import type { DocumentType } from "@/lib/db/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [township, counts] = await Promise.all([
    getTownshipById(id),
    getDocumentCounts(id),
  ]);
  if (!township) return {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const title = `${township.name}, ${township.state} Public Records`;
  const description =
    total > 0
      ? `${total} public records from ${township.name}, ${township.state} — agendas, meeting minutes, budgets, and more.`
      : `Public records from ${township.name}, ${township.state} — agendas, meeting minutes, and more.`;
  return {
    title,
    description,
    openGraph: { title, description, url: `/townships/${id}` },
    alternates: { canonical: `/townships/${id}` },
  };
}

export const revalidate = 3600;

export default async function TownshipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; view?: string }>;
}) {
  const { id } = await params;
  const { type: rawType, view } = await searchParams;

  const township = await getTownshipById(id);
  if (!township) notFound();

  const selectedType =
    rawType && (DOCUMENT_TYPES as readonly string[]).includes(rawType)
      ? (rawType as DocumentType)
      : undefined;

  const [{ documents, nextCursor }, counts, monthCounts, recentByType, recentSummaries, topTopics] =
    await Promise.all([
      getDocumentsByTownship(id, { type: selectedType }),
      getDocumentCounts(id),
      getDocumentMonthCounts(id),
      getMostRecentByType(id),
      getRecentSummaries(id, 3),
      getTopTopics(id, 12),
    ]);

  const totalDocs = Object.values(counts).reduce((a, b) => a + b, 0);
  const showDashboard = view !== "documents";

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <SiteHeader
        slim
        backHref="/"
        backLabel="All townships"
        rightSlot={<StatusBadge status={township.status} />}
      />

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-10">
        {/* Township info */}
        <section className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100 font-[family-name:var(--font-display)]">
              {township.name}
            </h1>
            <p className="mt-1.5 text-sm text-stone-500">
              {township.state} ·{" "}
              <a
                href={township.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Official website ↗
              </a>
            </p>
          </div>
          <div className="shrink-0 text-right text-xs text-stone-400">
            {township.last_scraped_at ? (
              <>Last indexed {formatDate(township.last_scraped_at)}</>
            ) : (
              "Not yet indexed"
            )}
          </div>
        </section>

        {/* View toggle */}
        <nav className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1 w-fit dark:border-stone-800 dark:bg-stone-900">
          {[
            { label: "Overview", href: `/townships/${id}` },
            { label: "Documents", href: `/townships/${id}?view=documents` },
          ].map(({ label, href }) => {
            const active =
              label === "Overview" ? showDashboard : !showDashboard;
            return (
              <Link
                key={label}
                href={href}
                className={
                  active
                    ? "rounded-md bg-stone-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-stone-100 dark:text-stone-900"
                    : "rounded-md px-4 py-1.5 text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {showDashboard ? (
          /* ── Overview / Dashboard ─────────────────────────────── */
          <div className="space-y-8">
            {/* AI area insights */}
            <AreaInsightsCard
              insights={township.ai_insights}
              updatedAt={township.insights_updated_at}
            />

            {/* AI-generated meeting digests */}
            {recentSummaries.length > 0 && (
              <div>
                <h2 className="mb-4 text-sm font-semibold text-stone-900 dark:text-stone-100">
                  What&apos;s been discussed
                </h2>
                <MeetingDigest docs={recentSummaries} />
              </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {DOCUMENT_TYPES.map((type) => (
                <Link
                  key={type}
                  href={`/townships/${id}?view=documents&type=${type}`}
                  className="group flex flex-col gap-1 rounded-xl border border-stone-200 bg-white px-4 py-4 capitalize transition-colors hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-600"
                >
                  <span className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                    {counts[type]}
                  </span>
                  <span className="text-xs text-stone-500 group-hover:text-stone-700 dark:group-hover:text-stone-300">
                    {type}
                  </span>
                </Link>
              ))}
            </div>

            {/* Document activity chart */}
            <div className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
              <h2 className="mb-1 text-sm font-semibold text-stone-900 dark:text-stone-100">
                Document activity
              </h2>
              <p className="mb-4 text-xs text-stone-400">Last 12 months</p>
              <DocumentTimeline data={monthCounts} />
            </div>

            {/* Type breakdown */}
            {totalDocs > 0 && (
              <div className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
                <h2 className="mb-4 text-sm font-semibold text-stone-900 dark:text-stone-100">
                  Document breakdown
                </h2>
                <TypeBreakdown counts={counts} />
              </div>
            )}

            {/* Most recent by type */}
            <div>
              <h2 className="mb-4 text-sm font-semibold text-stone-900 dark:text-stone-100">
                Quick access
              </h2>
              <RecentByType recentByType={recentByType} />
            </div>

            {/* Trending topics */}
            {topTopics.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-stone-900 dark:text-stone-100">
                  Trending topics
                </h2>
                <div className="flex flex-wrap gap-2">
                  {topTopics.map(({ topic, count }) => (
                    <Link
                      key={topic}
                      href={`/search?q=${encodeURIComponent(topic)}`}
                      className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-800 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
                    >
                      {topic}
                      <span className="text-xs text-amber-500 dark:text-amber-500">{count}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Documents view ───────────────────────────────────── */
          <div>
            {/* Type filter */}
            <nav className="mb-6 flex flex-wrap gap-2">
              <Link
                href={`/townships/${id}?view=documents`}
                className={
                  !selectedType
                    ? "rounded-full bg-stone-900 px-3 py-1 text-sm font-medium text-white dark:bg-stone-100 dark:text-stone-900"
                    : "rounded-full border border-stone-300 px-3 py-1 text-sm text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
                }
              >
                All{" "}
                <span className="ml-1 text-xs opacity-60">{totalDocs}</span>
              </Link>
              {DOCUMENT_TYPES.map((t) => (
                <Link
                  key={t}
                  href={`/townships/${id}?view=documents&type=${t}`}
                  className={
                    selectedType === t
                      ? "rounded-full bg-stone-900 px-3 py-1 text-sm font-medium capitalize text-white dark:bg-stone-100 dark:text-stone-900"
                      : "rounded-full border border-stone-300 px-3 py-1 text-sm capitalize text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
                  }
                >
                  {t}
                  {counts[t] > 0 && (
                    <span className="ml-1.5 text-xs opacity-60">{counts[t]}</span>
                  )}
                </Link>
              ))}
            </nav>

            <DocumentList
              documents={documents}
              emptyMessage={
                selectedType
                  ? `No ${selectedType} documents found for this township.`
                  : "No documents indexed yet."
              }
            />
            <LoadMore townshipId={id} type={selectedType} initialCursor={nextCursor} />
          </div>
        )}
      </main>
    </div>
  );
}
