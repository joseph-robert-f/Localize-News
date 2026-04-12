/**
 * Scraper: Nashville, TN (Metropolitan Nashville-Davidson County)
 *
 * Target: https://nashville.legistar.com
 * Documents: Metro Council agendas and meeting minutes via Legistar
 *
 * Run in isolation:
 *   npx tsx scrapers/nashville-tn.ts
 */

import { scrapeLegistar } from "./legistar";
import type { ScraperResult } from "./types";

const TOWNSHIP_ID_PLACEHOLDER = "00000000-0000-0000-0000-000000000011";

export async function scrapeNashvilleTN(
  townshipId = TOWNSHIP_ID_PLACEHOLDER
): Promise<ScraperResult> {
  console.log("[nashville-tn] Scraping via Legistar…");
  const { documents, errors } = await scrapeLegistar("nashville");
  return { townshipId, documents, errors };
}

// ── Standalone runner ─────────────────────────────────────────────────────────
if (require.main === module) {
  scrapeNashvilleTN()
    .then((result) => {
      console.log("\n─── Result ───");
      console.log(`Documents: ${result.documents.length}`);
      console.log(`Errors:    ${result.errors.length}`);
      for (const doc of result.documents.slice(0, 5)) {
        console.log(`  [${doc.type}] ${doc.title} (${doc.date ?? "no date"})`);
      }
      if (result.errors.length > 0) console.log("Errors:", result.errors);
    })
    .catch(console.error);
}
