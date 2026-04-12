/**
 * Scraper: City of Columbus, OH
 *
 * Target: https://columbus.legistar.com
 * Documents: City Council agendas and meeting minutes via Legistar
 *
 * Run in isolation:
 *   npx tsx scrapers/columbus-oh.ts
 */

import { scrapeLegistar } from "./legistar";
import type { ScraperResult } from "./types";

const TOWNSHIP_ID_PLACEHOLDER = "00000000-0000-0000-0000-000000000013";

export async function scrapeColumbusOH(
  townshipId = TOWNSHIP_ID_PLACEHOLDER
): Promise<ScraperResult> {
  console.log("[columbus-oh] Scraping via Legistar…");
  const { documents, errors } = await scrapeLegistar("columbus");
  return { townshipId, documents, errors };
}

// ── Standalone runner ─────────────────────────────────────────────────────────
if (require.main === module) {
  scrapeColumbusOH()
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
