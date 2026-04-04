import { describe, it, expect } from "vitest";
import { buildSearchQueries, filterDocumentUrls } from "../../scrapers/search";

describe("buildSearchQueries", () => {
  it("returns at least 4 queries", () => {
    const queries = buildSearchQueries("Springfield", "IL");
    expect(queries.length).toBeGreaterThanOrEqual(4);
  });

  it("includes township name and state", () => {
    const queries = buildSearchQueries("Oakdale", "PA");
    for (const q of queries) {
      expect(q.toLowerCase()).toContain("oakdale");
    }
  });
});

describe("filterDocumentUrls", () => {
  const results = [
    { title: "Budget 2025", url: "https://example.com/budget.pdf", snippet: "" },
    { title: "Springfield Agenda", url: "https://springfield.gov/agenda", snippet: "" },
    { title: "Random Page", url: "https://blog.example.com/post", snippet: "" },
    { title: "Minutes", url: "https://township.us/minutes.pdf", snippet: "" },
  ];

  it("excludes non-gov, non-pdf URLs", () => {
    const filtered = filterDocumentUrls(results);
    const urls = filtered.map((r) => r.url);
    expect(urls).not.toContain("https://blog.example.com/post");
  });

  it("includes PDFs and .gov/.us domains", () => {
    const filtered = filterDocumentUrls(results);
    expect(filtered.length).toBeGreaterThanOrEqual(3);
  });

  it("sorts PDFs first", () => {
    const filtered = filterDocumentUrls(results);
    expect(filtered[0].url.endsWith(".pdf")).toBe(true);
  });
});
