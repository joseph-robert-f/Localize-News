/**
 * Scraper registry.
 *
 * Maps township website hostnames to their specific hand-crafted scraper functions.
 * The orchestrator checks this before falling back to the generic search pipeline.
 *
 * To add a new township:
 *   1. Create scrapers/your-township.ts following the springfield-il.ts pattern
 *   2. Import and register it here
 *   3. Add the township row to supabase/seed.sql
 */

import type { ScraperResult } from "./types";

type ScraperFn = (townshipId: string) => Promise<ScraperResult>;

// Populated by registerAll() — do not access directly
const REGISTRY: Record<string, ScraperFn> = {};

/**
 * Lazily load and register all hand-crafted scrapers.
 * Called once per orchestrator run before the township loop.
 * Idempotent — safe to call multiple times (no-op if already registered).
 */
export async function registerAll(): Promise<void> {
  if (Object.keys(REGISTRY).length > 0) return;
  const [
    { scrapeSpringfieldIL },
    { scrapeNapervilleIL },
    { scrapeAnnArborMI },
    { scrapeCheltenhamPA },
    { scrapeBostonMA },
    { scrapeNashvilleTN },
    { scrapeDenverCO },
    { scrapeColumbusOH },
    { scrapePortlandOR },
    { scrapePittsburghPA },
    { scrapeSeattleWA },
    { scrapeCharlotteNC },
    { scrapeRaleighNC },
    { scrapeBuffaloNY },
    { scrapeProvidenceRI },
  ] = await Promise.all([
    import("./springfield-il"),
    import("./naperville-il"),
    import("./ann-arbor-mi"),
    import("./cheltenham-pa"),
    import("./boston-ma"),
    import("./nashville-tn"),
    import("./denver-co"),
    import("./columbus-oh"),
    import("./portland-or"),
    import("./pittsburgh-pa"),
    import("./seattle-wa"),
    import("./charlotte-nc"),
    import("./raleigh-nc"),
    import("./buffalo-ny"),
    import("./providence-ri"),
  ]);

  REGISTRY["springfield.il.us"]       = scrapeSpringfieldIL;
  REGISTRY["naperville.il.us"]        = scrapeNapervilleIL;
  REGISTRY["a2gov.org"]               = scrapeAnnArborMI;
  REGISTRY["cheltenham-township.org"] = scrapeCheltenhamPA;
  REGISTRY["boston.gov"]              = scrapeBostonMA;
  REGISTRY["nashville.gov"]           = scrapeNashvilleTN;
  REGISTRY["denvergov.org"]           = scrapeDenverCO;
  REGISTRY["columbus.gov"]            = scrapeColumbusOH;
  REGISTRY["portland.gov"]            = scrapePortlandOR;
  REGISTRY["pittsburghpa.gov"]        = scrapePittsburghPA;
  REGISTRY["seattle.gov"]             = scrapeSeattleWA;
  REGISTRY["charlottenc.gov"]         = scrapeCharlotteNC;
  REGISTRY["raleighnc.gov"]           = scrapeRaleighNC;
  REGISTRY["buffalony.gov"]           = scrapeBuffaloNY;
  REGISTRY["providenceri.gov"]        = scrapeProvidenceRI;
}

/**
 * Return the specific scraper for a township URL, or null if none is registered.
 * Strips leading "www." and lowercases the hostname before lookup.
 */
export function getScraperForUrl(websiteUrl: string): ScraperFn | null {
  try {
    const host = new URL(websiteUrl).hostname.replace(/^www\./i, "").toLowerCase();
    return REGISTRY[host] ?? null;
  } catch {
    return null;
  }
}
