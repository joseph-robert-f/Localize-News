/**
 * Web search helpers for document discovery.
 *
 * Architecture: a `SearchProvider` interface lets callers stay agnostic about
 * the underlying search engine. Two implementations are provided:
 *
 *   BraveSearchProvider  — Brave Search API (paid / free tier: 2,000 req/month)
 *                          Requires BRAVE_SEARCH_API_KEY env var.
 *                          Reliable, no HTML parsing, structured JSON response.
 *
 *   DuckDuckGoProvider   — Scrapes DDG's HTML lite interface (no key required).
 *                          Fragile: breaks if DDG changes their markup.
 *                          Use only as a fallback / in development.
 *
 * The `getSearchProvider()` factory auto-selects based on env vars.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  search(query: string, maxResults?: number): Promise<SearchResult[]>;
}

// ─── Query builder ──────────────────────────────────────────────────────────

/**
 * Build document-discovery search queries for a township.
 * Returns an array of query strings to run sequentially.
 */
export function buildSearchQueries(townshipName: string, state: string): string[] {
  const base = `${townshipName} ${state} township`;
  return [
    `${base} meeting agenda filetype:pdf`,
    `${base} meeting minutes filetype:pdf`,
    `${base} budget filetype:pdf`,
    `${base} board meeting documents site:*.gov OR site:*.us`,
    `${base} public records agenda minutes`,
  ];
}

// ─── Provider factory ───────────────────────────────────────────────────────

/**
 * Return the best available search provider.
 * Prefers Brave if BRAVE_SEARCH_API_KEY is set, otherwise falls back to DDG.
 */
export function getSearchProvider(): SearchProvider {
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey) {
    return new BraveSearchProvider(braveKey);
  }
  console.warn(
    "[search] BRAVE_SEARCH_API_KEY not set — falling back to DuckDuckGo HTML scrape. " +
    "Set BRAVE_SEARCH_API_KEY for reliable production use."
  );
  return new DuckDuckGoProvider();
}

// ─── Brave Search ───────────────────────────────────────────────────────────

/**
 * Brave Search API provider.
 * Docs: https://api.search.brave.com/app/documentation/web-search/get-started
 * Free tier: 2,000 queries/month. No HTML parsing.
 */
export class BraveSearchProvider implements SearchProvider {
  private readonly apiKey: string;
  private static readonly BASE_URL = "https://api.search.brave.com/res/v1/web/search";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, maxResults = 10): Promise<SearchResult[]> {
    const url = new URL(BraveSearchProvider.BASE_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(maxResults, 20)));
    url.searchParams.set("safesearch", "off");
    url.searchParams.set("text_decorations", "false");

    let data: unknown;
    try {
      const res = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": this.apiKey,
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Brave Search HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.error(`[search] Brave Search failed for "${query}":`, err);
      return [];
    }

    return parseBraveResponse(data);
  }
}

function parseBraveResponse(data: unknown): SearchResult[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  const results = (d.web as Record<string, unknown> | undefined)?.results;
  if (!Array.isArray(results)) return [];

  return results.map((r: unknown) => {
    const item = r as Record<string, unknown>;
    return {
      title: String(item.title ?? ""),
      url: String(item.url ?? ""),
      snippet: String(item.description ?? ""),
    };
  }).filter((r) => r.url.startsWith("http"));
}

// ─── DuckDuckGo (fallback) ──────────────────────────────────────────────────

/**
 * DuckDuckGo HTML lite scraper — no API key required.
 *
 * WARNING: This parses DDG's server-rendered HTML with regex. It will break
 * if DDG changes their markup. Use BraveSearchProvider for production.
 */
export class DuckDuckGoProvider implements SearchProvider {
  async search(query: string, maxResults = 10): Promise<SearchResult[]> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    let html: string;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; LocalizeNewsBot/1.0; +https://localizenews.app/bot)",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`DDG HTTP ${res.status}`);
      html = await res.text();
    } catch (err) {
      console.error(`[search] DDG request failed for "${query}":`, err);
      return [];
    }

    return parseDdgHtml(html, maxResults);
  }
}

function parseDdgHtml(html: string, maxResults: number): SearchResult[] {
  const resultPattern =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const snippetPattern =
    /<a[^>]+class="result__snippet"[^>]*>([^<]*(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)<\/a>/g;

  const urls: Array<{ url: string; title: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = resultPattern.exec(html)) !== null && urls.length < maxResults) {
    const rawUrl = match[1];
    const title = match[2].replace(/&amp;/g, "&").replace(/&#\d+;/g, "").trim();
    const uddg = new URLSearchParams(rawUrl.split("?")[1] ?? "").get("uddg");
    const url = uddg ? decodeURIComponent(uddg) : rawUrl;
    if (url.startsWith("http")) urls.push({ url, title });
  }

  const snippets: string[] = [];
  while ((match = snippetPattern.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, "").trim());
  }

  return urls.map((u, i) => ({
    title: u.title,
    url: u.url,
    snippet: snippets[i] ?? "",
  }));
}

// ─── Filter ────────────────────────────────────────────────────────────────

/**
 * Filter search results to those likely to be public documents.
 * Prioritises PDF links and known government TLDs.
 */
export function filterDocumentUrls(results: SearchResult[]): SearchResult[] {
  const GOV_TLDS = /\.(gov|us|org)(\.|\/|$)/i;
  const DOC_EXTS = /\.(pdf|doc|docx)(\?|$)/i;

  return results
    .filter((r) => DOC_EXTS.test(r.url) || GOV_TLDS.test(r.url))
    .sort((a, b) => {
      const aPdf = DOC_EXTS.test(a.url) ? 0 : 1;
      const bPdf = DOC_EXTS.test(b.url) ? 0 : 1;
      return aPdf - bPdf;
    });
}

// ─── Convenience re-export (backwards compat for pipeline.ts) ───────────────

/** @deprecated Use getSearchProvider().search() directly. */
export async function searchDuckDuckGo(
  query: string,
  maxResults = 10
): Promise<SearchResult[]> {
  return new DuckDuckGoProvider().search(query, maxResults);
}
