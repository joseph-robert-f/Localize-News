/**
 * Scraper integration test for Cheltenham Township, PA.
 *
 * This test hits the real township website and validates the scraper output.
 * Tagged @slow — excluded from the default CI run.
 *
 * Run explicitly:
 *   npx playwright test tests/e2e/scrapers/cheltenham-pa.spec.ts
 */

import { test, expect } from "@playwright/test";
import { scrapeCheltenhamPA } from "../../../scrapers/cheltenham-pa";

test.describe("Cheltenham PA scraper @slow", () => {
  test("returns documents without crashing", async () => {
    const result = await scrapeCheltenhamPA("test-township-id");

    expect(result.townshipId).toBe("test-township-id");

    if (result.errors.length > 0) {
      console.warn("[test] Scraper errors:", result.errors);
    }

    for (const doc of result.documents) {
      expect(doc).toMatchObject({
        type: expect.stringMatching(/^(agenda|minutes|proposal|budget|other)$/),
        title: expect.any(String),
        sourceUrl: expect.stringContaining("http"),
      });
      expect(doc.title.length).toBeGreaterThan(0);
    }
  });
});
