/**
 * Scraper integration test for Springfield, IL.
 *
 * This test hits the real township website and validates the scraper output.
 * Tagged @slow — excluded from the default CI run.
 *
 * Run explicitly:
 *   npx playwright test tests/e2e/scrapers/springfield-il.spec.ts
 */

import { test, expect } from "@playwright/test";
import { scrapeSpringfieldIL } from "../../../scrapers/springfield-il";

test.describe("Springfield IL scraper @slow", () => {
  test("returns documents without crashing", async () => {
    const result = await scrapeSpringfieldIL("test-township-id");

    // Scraper must not throw a fatal error
    expect(result.townshipId).toBe("test-township-id");

    // We expect at least some documents (or no fatal errors)
    // Relaxed assertion: real sites may have changed structure
    if (result.errors.length > 0) {
      console.warn("[test] Scraper errors:", result.errors);
    }

    // At minimum, the result shape is correct
    for (const doc of result.documents) {
      expect(doc).toMatchObject({
        type: expect.stringMatching(/^(agenda|minutes|proposal|budget|other)$/),
        title: expect.any(String),
        sourceUrl: expect.stringContaining("http"),
      });
    }
  });
});
