/**
 * Scraper: City of Richmond, VA
 *
 * Target: https://richmond.legistar.com/Calendar.aspx
 * Documents: City Council agendas and meeting minutes via Legistar
 *
 * Run in isolation:
 *   npx tsx scrapers/richmond-va.ts
 */

import { scrapeLegistar } from "./legistar";
import type { ScraperResult } from "./types";

const TOWNSHIP_ID_PLACEHOLDER = "00000000-0000-0000-0000-000000000024";

export async function scrapeRichmondVA(
  townshipId = TOWNSHIP_ID_PLACEHOLDER
): Promise<ScraperResult> {
  console.log("[richmond-va] Scraping via Legistar…");
  const { documents, errors } = await scrapeLegistar("richmond");
  return { townshipId, documents, errors };
}

if (require.main === module) {
  scrapeRichmondVA()
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
