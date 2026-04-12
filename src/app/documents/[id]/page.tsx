import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getDocumentById } from "@/lib/db/documents";
import { getTownshipById } from "@/lib/db/townships";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatCategory } from "@/lib/utils";
import type { DocumentType } from "@/lib/db/types";

const typeConfig: Record<DocumentType, { label: string; variant: "info" | "default" | "success" | "warning" }> = {
  agenda:   { label: "Agenda",   variant: "info" },
  minutes:  { label: "Minutes",  variant: "default" },
  proposal: { label: "Proposal", variant: "warning" },
  budget:   { label: "Budget",   variant: "success" },
  other:    { label: "Other",    variant: "default" },
};

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const doc = await getDocumentById(id);
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.ai_summary ?? `${doc.type} document from local government.`,
    alternates: { canonical: `/documents/${id}` },
  };
}

export const revalidate = 3600;

export default async function DocumentPage({ params }: Props) {
  const { id } = await params;

  const doc = await getDocumentById(id);
  if (!doc) notFound();

  const township = await getTownshipById(doc.township_id);

  const { label, variant } = typeConfig[doc.type] ?? typeConfig.other;
  const isPdf = !!doc.file_url?.toLowerCase().endsWith(".pdf") || !!doc.file_url?.includes("View.ashx");

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <SiteHeader
        slim
        backHref={township ? `/townships/${township.id}` : "/"}
        backLabel={township ? `${township.name}` : "All townships"}
      />

      <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">

        {/* Header */}
        <section>
          {township && (
            <nav className="mb-3 flex items-center gap-1.5 text-xs text-stone-400" aria-label="Breadcrumb">
              <Link href={`/coverage/${township.state.toLowerCase()}`} className="hover:text-stone-600">
                {township.state}
              </Link>
              {township.county && (
                <>
                  <span>›</span>
                  <span>{township.county}</span>
                </>
              )}
              <span>›</span>
              <Link href={`/townships/${township.id}`} className="hover:text-stone-600">
                {township.name}
              </Link>
            </nav>
          )}

          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 font-[family-name:var(--font-display)] leading-snug">
              {doc.title}
            </h1>
            <Badge variant={variant} className="shrink-0 mt-1">{label}</Badge>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-500">
            {doc.date && <span>{formatDate(doc.date)}</span>}
            {township && (
              <>
                {doc.date && <span className="text-stone-300 dark:text-stone-600">·</span>}
                <Link href={`/townships/${township.id}`} className="hover:underline text-amber-700 dark:text-amber-400">
                  {township.name}{township.category ? ` ${formatCategory(township.category)}` : ""}, {township.state}
                </Link>
              </>
            )}
          </div>
        </section>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          {doc.file_url && (
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Open PDF
            </a>
          )}
          <a
            href={doc.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            View source ↗
          </a>
        </div>

        {/* AI Summary */}
        {doc.ai_summary && (
          <section className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 dark:border-blue-900/30 dark:bg-blue-950/20">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-400">
              AI Summary
            </p>
            <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">
              {doc.ai_summary}
            </p>
          </section>
        )}

        {/* Topics */}
        {doc.topics && doc.topics.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400">Topics</p>
            <div className="flex flex-wrap gap-2">
              {doc.topics.map((topic) => (
                <Link
                  key={topic}
                  href={`/search?q=${encodeURIComponent(topic)}`}
                  className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
                >
                  {topic}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Inline PDF viewer */}
        {isPdf && doc.file_url && (
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
              Document preview
            </p>
            <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800">
              <iframe
                src={doc.file_url}
                title={doc.title}
                className="h-[70vh] w-full bg-white"
                loading="lazy"
              />
            </div>
            <p className="mt-2 text-xs text-stone-400">
              Preview blocked by the source? Use the "Open PDF" button above.
            </p>
          </section>
        )}

        {/* Full text content */}
        {!isPdf && doc.content && (
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
              Full text
            </p>
            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700 dark:text-stone-300 font-sans">
                {doc.content}
              </pre>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
