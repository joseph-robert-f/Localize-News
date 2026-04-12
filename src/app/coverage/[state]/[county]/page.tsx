import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTownshipsByState } from "@/lib/db/townships";
import { getTotalDocsByTownships } from "@/lib/db/documents";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { StateCountyMap } from "@/components/coverage/StateCountyMap";
import { STATE_FIPS, STATE_NAMES } from "@/lib/constants/states";
import {
  countySlug,
  countyLabel,
  formatCategory,
  formatDate,
} from "@/lib/utils";
import type { Township } from "@/lib/db/types";

/**
 * CoverageSection — extensible interface for content blocks on this page.
 *
 * When school districts (or other sub-county entities) are added as a layer,
 * they slot in here as an additional CoverageSection rendered below municipalities.
 *
 * @example
 * const schoolSection: CoverageSection = {
 *   id:    "school-districts",
 *   label: "School Districts",
 *   items: schoolDistricts.map(sd => ({ ... })),
 * };
 */
export type CoverageSection = {
  id: string;
  label: string;
  items: CoverageSectionItem[];
};

export type CoverageSectionItem = {
  id: string;
  name: string;
  category: string | null;
  href: string;
  lastScrapedAt: string | null;
  population: number | null;
  docCount: number;
};

// ─────────────────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ state: string; county: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state, county } = await params;
  const abbr = state.toUpperCase();
  const stateName = STATE_NAMES[abbr];
  if (!stateName) return {};
  const displayCounty = county.replace(/-/g, " ");
  const cl = countyLabel(abbr);
  return {
    title: `${displayCounty} ${cl}, ${stateName} Coverage`,
    description: `Browse all indexed municipalities in ${displayCounty} ${cl}, ${stateName}.`,
  };
};

export const revalidate = 3600;

export default async function CountyCoveragePage({ params }: Props) {
  const { state, county: countyParam } = await params;
  const abbr = state.toUpperCase();
  const stateName = STATE_NAMES[abbr];

  if (!stateName || !STATE_FIPS[abbr]) notFound();

  const cl = countyLabel(abbr);

  // Fetch all active townships in this state, filter to the requested county by slug
  let allTownships: Township[] = [];
  try {
    allTownships = await getTownshipsByState(abbr);
  } catch (err) {
    console.error(`[coverage/${abbr}/${countyParam}] DB error:`, err);
  }

  const townships = allTownships.filter(
    (t) => t.county !== null && countySlug(t.county) === countyParam
  );

  // Derive the display county name from the first matched township
  const countyName = townships[0]?.county ?? countyParam.replace(/-/g, " ");

  if (allTownships.length > 0 && townships.length === 0) {
    // State exists but no townships in this county — might be an invalid slug
    // Still render the page (empty state), don't 404 (county may just lack coverage)
  }

  // Doc counts per township
  const docCounts = await getTotalDocsByTownships(townships.map((t) => t.id));

  // Build the municipalities CoverageSection
  const municipalitiesSection: CoverageSection = {
    id: "municipalities",
    label: "Municipalities",
    items: townships
      .sort((a, b) => {
        // Sort by category first (city > borough > township > village > town), then name
        const order = ["city", "borough", "township", "village", "town"];
        const ai = order.indexOf(a.category ?? "");
        const bi = order.indexOf(b.category ?? "");
        if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        return a.name.localeCompare(b.name);
      })
      .map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        href: `/townships/${t.id}`,
        lastScrapedAt: t.last_scraped_at,
        population: t.population,
        docCount: docCounts[t.id] ?? 0,
      })),
  };

  // ── Placeholder: school districts go here when that layer is built ──────
  // const schoolSection: CoverageSection = { id: "school-districts", label: "School Districts", items: [] };
  // const sections = [municipalitiesSection, schoolSection];
  const sections: CoverageSection[] = [municipalitiesSection];

  // Coverage data for context map (pass just this county's data)
  const coverageByCounty: Record<string, number> = {};
  const municipalsByCounty: Record<string, string[]> = {};
  for (const t of allTownships) {
    if (!t.county) continue;
    coverageByCounty[t.county] = (coverageByCounty[t.county] ?? 0) + 1;
    (municipalsByCounty[t.county] ??= []).push(t.name);
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <SiteHeader
        slim
        backHref={`/coverage/${abbr.toLowerCase()}`}
        backLabel={`${stateName} coverage`}
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
          <nav className="mb-2 flex items-center gap-1.5 text-xs text-stone-400" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-stone-600">Home</Link>
            <span>›</span>
            <Link href={`/coverage/${abbr.toLowerCase()}`} className="hover:text-stone-600">{stateName}</Link>
            <span>›</span>
            <span className="text-stone-500">{countyName} {cl}</span>
          </nav>

          <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100 font-[family-name:var(--font-display)]">
            {countyName} {cl}
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            {townships.length === 0
              ? `No municipalities indexed in ${countyName} ${cl} yet.`
              : `${townships.length} municipalit${townships.length === 1 ? "y" : "ies"} · ${stateName}`}
          </p>
        </section>

        {/* Context map — state with this county highlighted, not navigable */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-stone-400">
            Location within {stateName}
          </h2>
          <StateCountyMap
            stateAbbr={abbr}
            coverageByCounty={coverageByCounty}
            municipalsByCounty={municipalsByCounty}
            highlightedCounty={countyName}
            navigable={false}
          />
        </section>

        {/* Coverage sections — municipalities now, extensible for school districts etc. */}
        {sections.map((section) => (
          <section key={section.id}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-stone-400">
              {section.label}
              {section.items.length > 0 && (
                <span className="ml-2 font-normal normal-case tracking-normal">
                  · {section.items.length}
                </span>
              )}
            </h2>

            {section.items.length === 0 ? (
              <div className="rounded-xl border border-stone-200 bg-white px-6 py-10 text-center dark:border-stone-800 dark:bg-stone-900">
                <p className="text-sm text-stone-500 mb-3">
                  No {section.label.toLowerCase()} indexed here yet.
                </p>
                <Link
                  href="/request"
                  className="inline-flex items-center rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
                >
                  Request coverage
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {section.items.map((item) => (
                  <MunicipalityCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}

// ── Municipality card ─────────────────────────────────────────────────────────

function docHeatColor(count: number): string {
  if (count === 0) return "border-stone-200 dark:border-stone-800";
  if (count < 10) return "border-amber-200 dark:border-amber-900";
  if (count < 50) return "border-amber-300 dark:border-amber-800";
  if (count < 200) return "border-amber-400 dark:border-amber-700";
  return "border-amber-600 dark:border-amber-600";
}

function MunicipalityCard({ item }: { item: CoverageSectionItem }) {
  return (
    <Link
      href={item.href}
      className={`flex items-start justify-between gap-3 rounded-xl border-2 bg-white px-4 py-3.5 transition-all hover:shadow-sm dark:bg-stone-900 ${docHeatColor(item.docCount)}`}
    >
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-semibold text-stone-900 dark:text-stone-100 truncate">
          {item.name}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {item.category && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-400">
              {formatCategory(item.category)}
            </span>
          )}
          {item.population && (
            <span className="text-xs text-stone-400">
              Pop. {item.population.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {item.docCount > 0 ? (
          <>
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {item.docCount.toLocaleString()}
            </p>
            <p className="text-xs text-stone-400">docs</p>
          </>
        ) : (
          <p className="text-xs text-stone-400 mt-1">
            {item.lastScrapedAt ? formatDate(item.lastScrapedAt) : "not scraped"}
          </p>
        )}
      </div>
    </Link>
  );
}
