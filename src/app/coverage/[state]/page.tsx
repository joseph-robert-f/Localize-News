import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTownshipsByState } from "@/lib/db/townships";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { StateCountyMap, STATE_FIPS } from "@/components/coverage/StateCountyMap";
import type { Township } from "@/lib/db/types";

// Full state name lookup
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming",
};

type Props = { params: Promise<{ state: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params;
  const abbr = state.toUpperCase();
  const stateName = STATE_NAMES[abbr];
  if (!stateName) return {};
  return {
    title: `${stateName} Coverage`,
    description: `Browse all indexed municipalities in ${stateName} — agendas, minutes, budgets, and more.`,
  };
}

export const revalidate = 3600;

export default async function StateCoveragePage({ params }: Props) {
  const { state } = await params;
  const abbr = state.toUpperCase();
  const stateName = STATE_NAMES[abbr];

  // Validate state
  if (!stateName || !STATE_FIPS[abbr]) notFound();

  let townships: Township[] = [];
  try {
    townships = await getTownshipsByState(abbr);
  } catch (err) {
    console.error(`[coverage/${abbr}] Failed to load townships:`, err);
  }

  // Build county-level coverage maps
  const coverageByCounty: Record<string, number> = {};
  const municipalsByCounty: Record<string, string[]> = {};
  const uncategorized: Township[] = [];

  for (const t of townships) {
    if (t.county) {
      coverageByCounty[t.county] = (coverageByCounty[t.county] ?? 0) + 1;
      (municipalsByCounty[t.county] ??= []).push(t.name);
    } else {
      uncategorized.push(t);
    }
  }

  // Group counties alphabetically for the list view
  const sortedCounties = Object.keys(municipalsByCounty).sort();

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <SiteHeader
        slim
        backHref="/"
        backLabel="All states"
        rightSlot={
          <Link
            href="/request"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Request a township
          </Link>
        }
      />

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-10">
        {/* Header */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
            Coverage
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100 font-[family-name:var(--font-display)]">
            {stateName}
          </h1>
          <p className="mt-2 text-stone-500 text-sm">
            {townships.length === 0
              ? "No municipalities indexed yet."
              : `${townships.length} municipalit${townships.length === 1 ? "y" : "ies"} indexed across ${sortedCounties.length} count${sortedCounties.length === 1 ? "y" : "ies"}.`}
          </p>
        </section>

        {/* County map */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-stone-400">
            County coverage
          </h2>
          <StateCountyMap
            stateAbbr={abbr}
            coverageByCounty={coverageByCounty}
            municipalsByCounty={municipalsByCounty}
          />
        </section>

        {/* Municipality list by county */}
        {sortedCounties.length > 0 && (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-stone-400">
              Indexed municipalities
            </h2>
            <div className="space-y-6">
              {sortedCounties.map((county) => {
                const names = municipalsByCounty[county] ?? [];
                const countyTownships = townships.filter((t) => t.county === county);
                return (
                  <div key={county}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                      {county} County
                      <span className="ml-2 font-normal normal-case tracking-normal text-stone-400">
                        · {names.length}
                      </span>
                    </h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {countyTownships
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((t) => (
                          <Link
                            key={t.id}
                            href={`/townships/${t.id}`}
                            className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm transition-colors hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-600"
                          >
                            <span className="font-medium text-stone-900 dark:text-stone-100">
                              {t.name}
                            </span>
                            <span className="ml-2 text-xs text-stone-400 shrink-0">
                              {t.last_scraped_at
                                ? new Date(t.last_scraped_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "not yet scraped"}
                            </span>
                          </Link>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Uncategorized (no county data) */}
        {uncategorized.length > 0 && (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-stone-400">
              Other municipalities
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {uncategorized.map((t) => (
                <Link
                  key={t.id}
                  href={`/townships/${t.id}`}
                  className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm transition-colors hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-600"
                >
                  <span className="font-medium text-stone-900 dark:text-stone-100">{t.name}</span>
                  <span className="ml-2 text-xs text-stone-400 shrink-0">
                    {t.last_scraped_at
                      ? new Date(t.last_scraped_at).toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        })
                      : "not yet scraped"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {townships.length === 0 && (
          <div className="rounded-xl border border-stone-200 bg-white px-6 py-12 text-center dark:border-stone-800 dark:bg-stone-900">
            <p className="text-sm text-stone-500 mb-3">
              No municipalities indexed in {stateName} yet.
            </p>
            <Link
              href="/request"
              className="inline-flex items-center rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
            >
              Request a township
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
