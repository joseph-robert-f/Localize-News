import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildSearchQueries,
  filterDocumentUrls,
  BraveSearchProvider,
  DuckDuckGoProvider,
  getSearchProvider,
} from "../../scrapers/search";

// ─── buildSearchQueries ─────────────────────────────────────────────────────

describe("buildSearchQueries", () => {
  it("returns at least 4 queries", () => {
    expect(buildSearchQueries("Springfield", "IL").length).toBeGreaterThanOrEqual(4);
  });

  it("includes township name in every query", () => {
    const queries = buildSearchQueries("Oakdale", "PA");
    for (const q of queries) {
      expect(q.toLowerCase()).toContain("oakdale");
    }
  });
});

// ─── filterDocumentUrls ─────────────────────────────────────────────────────

describe("filterDocumentUrls", () => {
  const results = [
    { title: "Budget 2025", url: "https://example.com/budget.pdf", snippet: "" },
    { title: "Agenda",      url: "https://springfield.gov/agenda",  snippet: "" },
    { title: "Blog post",   url: "https://blog.example.com/post",   snippet: "" },
    { title: "Minutes",     url: "https://township.us/minutes.pdf", snippet: "" },
  ];

  it("excludes non-gov, non-pdf URLs", () => {
    const filtered = filterDocumentUrls(results);
    expect(filtered.map((r) => r.url)).not.toContain("https://blog.example.com/post");
  });

  it("includes PDFs and .gov/.us domains", () => {
    expect(filterDocumentUrls(results).length).toBeGreaterThanOrEqual(3);
  });

  it("sorts PDFs first", () => {
    const filtered = filterDocumentUrls(results);
    expect(filtered[0].url.endsWith(".pdf")).toBe(true);
  });
});

// ─── BraveSearchProvider ────────────────────────────────────────────────────

describe("BraveSearchProvider", () => {
  const BRAVE_RESPONSE = {
    web: {
      results: [
        { title: "Agenda Jan 2026", url: "https://springfield.gov/agenda.pdf", description: "January meeting agenda" },
        { title: "Budget 2026",     url: "https://springfield.gov/budget.pdf", description: "Annual budget document" },
        { title: "Bad result",      url: "not-a-url",                          description: "" },
      ],
    },
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => BRAVE_RESPONSE,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns structured results from Brave API response", async () => {
    const provider = new BraveSearchProvider("test-key");
    const results = await provider.search("Springfield agenda", 5);
    expect(results).toHaveLength(2); // 3rd item filtered (not http)
    expect(results[0].url).toBe("https://springfield.gov/agenda.pdf");
    expect(results[0].title).toBe("Agenda Jan 2026");
    expect(results[0].snippet).toBe("January meeting agenda");
  });

  it("passes the API key as the subscription token header", async () => {
    const provider = new BraveSearchProvider("my-secret-key");
    await provider.search("test");
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].headers["X-Subscription-Token"]).toBe("my-secret-key");
  });

  it("returns empty array on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const provider = new BraveSearchProvider("key");
    const results = await provider.search("test");
    expect(results).toEqual([]);
  });

  it("returns empty array on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const provider = new BraveSearchProvider("key");
    const results = await provider.search("test");
    expect(results).toEqual([]);
  });
});

// ─── DuckDuckGoProvider ─────────────────────────────────────────────────────

describe("DuckDuckGoProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty array on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const provider = new DuckDuckGoProvider();
    const results = await provider.search("test");
    expect(results).toEqual([]);
  });

  it("returns empty array on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const provider = new DuckDuckGoProvider();
    const results = await provider.search("test");
    expect(results).toEqual([]);
  });
});

// ─── getSearchProvider ──────────────────────────────────────────────────────

describe("getSearchProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns BraveSearchProvider when BRAVE_SEARCH_API_KEY is set", () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "some-key");
    const provider = getSearchProvider();
    expect(provider).toBeInstanceOf(BraveSearchProvider);
  });

  it("falls back to DuckDuckGoProvider when key is absent", () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "");
    const provider = getSearchProvider();
    expect(provider).toBeInstanceOf(DuckDuckGoProvider);
  });
});
