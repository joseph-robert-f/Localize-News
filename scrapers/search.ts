/**
 * Web search helpers for document discovery.
 *
 * Strategy: we build targeted search queries for a township and parse the
 * HTML results from DuckDuckGo (no API key required). For production use, swap
 * the `searchDuckDuckGo` implementation for a paid search API (SerpAPI, Brave
 * Search, etc.) — the interface stays the same.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

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

/**
 * Run a DuckDuckGo HTML search and extract the top results.
 *
 * NOTE: This is a best-effort HTML scrape of DDG's lite interface.
 * For reliable production use, replace with a paid search API.
 */
export async function searchDuckDuckGo(
  query: string,
  maxResults = 10
): Promise<SearchResult[]> {
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.error(`[search] DDG request failed for "${query}":`, err);
    return [];
  }

  return parseDdgHtml(html, maxResults);
}

/**
 * Parse DuckDuckGo HTML lite results into structured SearchResult objects.
 * This is intentionally minimal — we only need URLs and titles.
 */
function parseDdgHtml(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];

  // Match result blocks: <a class="result__a" href="...">title</a>
  // DDG HTML lite wraps each result in a <div class="result">
  const resultPattern =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const snippetPattern = /<a[^>]+class="result__snippet"[^>]*>([^<]*(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)<\/a>/g;

  const urls: Array<{ url: string; title: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = resultPattern.exec(html)) !== null && urls.length < maxResults) {
    const rawUrl = match[1];
    const title = match[2].replace(/&amp;/g, "&").replace(/&#\d+;/g, "").trim();
    // DDG redirects — extract the actual URL from uddg= param
    const uddg = new URLSearchParams(rawUrl.split("?")[1] ?? "").get("uddg");
    const url = uddg ? decodeURIComponent(uddg) : rawUrl;
    if (url.startsWith("http")) urls.push({ url, title });
  }

  const snippets: string[] = [];
  while ((match = snippetPattern.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, "").trim());
  }

  for (let i = 0; i < urls.length; i++) {
    results.push({
      title: urls[i].title,
      url: urls[i].url,
      snippet: snippets[i] ?? "",
    });
  }

  return results;
}

/**
 * Filter search results to those likely to be public documents.
 * Prioritises PDF links and known government TLDs.
 */
export function filterDocumentUrls(results: SearchResult[]): SearchResult[] {
  const GOV_TLDS = /\.(gov|us|org)(\.|\/|$)/i;
  const DOC_EXTS = /\.(pdf|doc|docx)(\?|$)/i;

  return results
    .filter((r) => {
      // Always include direct PDF/doc links
      if (DOC_EXTS.test(r.url)) return true;
      // Include government / org domains
      if (GOV_TLDS.test(r.url)) return true;
      return false;
    })
    .sort((a, b) => {
      // PDFs first
      const aPdf = DOC_EXTS.test(a.url) ? 0 : 1;
      const bPdf = DOC_EXTS.test(b.url) ? 0 : 1;
      return aPdf - bPdf;
    });
}
