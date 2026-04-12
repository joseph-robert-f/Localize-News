import Link from "next/link";
import { getActiveTownships } from "@/lib/db/townships";
import { getTotalDocumentCount } from "@/lib/db/documents";
import { TownshipSearch } from "@/components/township/TownshipSearch";
import { RecentlyUpdated } from "@/components/home/RecentlyUpdated";
import { SiteHeader } from "@/components/layout/SiteHeader";
import type { Township } from "@/lib/db/types";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Town Crier — Local Government Records",
  description:
    "Search agendas, meeting minutes, budgets, and public proposals from local township and city governments across the United States.",
  openGraph: {
    title: "Town Crier — Local Government Records",
    description:
      "Search agendas, meeting minutes, budgets, and public proposals from local township and city governments across the United States.",
    url: "/",
  },
};

export const revalidate = 3600;

export default async function HomePage() {
  let townships: Township[] = [];
  let totalDocs = 0;

  try {
    [townships, totalDocs] = await Promise.all([
      getActiveTownships(),
      getTotalDocumentCount(),
    ]);
  } catch (err) {
    console.error("[HomePage] Failed to load data:", err);
  }

  const stateCount = new Set(townships.map((t) => t.state)).size;
  const recentlyUpdated = [...townships]
    .filter((t) => t.last_scraped_at)
    .sort((a, b) =>
      new Date(b.last_scraped_at!).getTime() - new Date(a.last_scraped_at!).getTime()
    )
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <SiteHeader
        rightSlot={
          <>
            <Link
              href="/search"
              className="text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
            >
              Search docs
            </Link>
            <Link
              href="/request"
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              Request a township
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-12">
        {/* Hero */}
        <section>
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100 font-[family-name:var(--font-display)]">
            Local government,<br />made searchable.
          </h1>
          <p className="max-w-lg text-stone-600 dark:text-stone-400 mb-6">
            We index agendas, minutes, budgets, and public proposals from township
            websites so you can search across all of them in one place.
          </p>
          {/* Inline search CTA */}
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 dark:bg-amber-100 dark:text-amber-950 dark:hover:bg-amber-200"
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
                className="rounded-xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900"
              >
                <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{value}</p>
                <p className="mt-0.5 text-xs text-stone-500">{label}</p>
              </div>
            ))}
          </section>
        )}

        {/* Recently updated */}
        {recentlyUpdated.length > 0 && (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-stone-400">
              Recently indexed
            </h2>
            <RecentlyUpdated townships={recentlyUpdated} />
          </section>
        )}

        {/* Full directory */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-stone-400">
            All townships {townships.length > 0 && `· ${townships.length}`}
          </h2>

          {townships.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-500">
              No townships indexed yet.{" "}
              <Link href="/request" className="underline hover:text-stone-800">
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
