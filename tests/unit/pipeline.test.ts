import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchBuffer } from "../../scrapers/ocr";
import { classifyError } from "../../scrapers/types";

// ─── fetchBuffer — retry logic ───────────────────────────────────────────────

describe("fetchBuffer retry logic", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns buffer on first successful response", async () => {
    const data = Buffer.from("PDF content");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => data.buffer,
    }));

    const result = await fetchBuffer("https://example.gov/doc.pdf");
    expect(result).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const result = await fetchBuffer("https://example.gov/missing.pdf");
    expect(result).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1); // no retries
  });

  it("does NOT retry on 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    const result = await fetchBuffer("https://example.gov/private.pdf");
    expect(result).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on network error and succeeds on second attempt", async () => {
    const data = Buffer.from("PDF content");
    vi.stubGlobal("fetch", vi.fn()
      .mockRejectedValueOnce(new Error("fetch failed: network error"))
      .mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => data.buffer,
      })
    );

    const result = await fetchBuffer("https://example.gov/doc.pdf");
    expect(result).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  }, 15_000);

  it("retries on 500 and eventually returns null after exhausting retries", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const result = await fetchBuffer("https://example.gov/doc.pdf");
    expect(result).toBeNull();
    // 1 initial + 3 retries = 4 calls
    expect(fetch).toHaveBeenCalledTimes(4);
  }, 30_000);

  it("returns null after all retries fail with network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("econnrefused")));

    const result = await fetchBuffer("https://example.gov/doc.pdf");
    expect(result).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(4); // 1 + 3 retries
  }, 30_000);
});

// ─── classifyError ───────────────────────────────────────────────────────────

describe("classifyError", () => {
  it("classifies timeout errors", () => {
    expect(classifyError(new Error("request timed out")).type).toBe("timeout");
    expect(classifyError(new Error("AbortError: abort")).type).toBe("timeout");
    expect(classifyError(new Error("signal timed out")).type).toBe("timeout");
  });

  it("classifies network errors", () => {
    expect(classifyError(new Error("fetch failed")).type).toBe("network");
    expect(classifyError(new Error("ECONNREFUSED")).type).toBe("network");
    expect(classifyError(new Error("ENOTFOUND")).type).toBe("network");
  });

  it("classifies auth errors", () => {
    expect(classifyError(new Error("HTTP 401 Unauthorized")).type).toBe("auth");
    expect(classifyError(new Error("403 forbidden")).type).toBe("auth");
  });

  it("classifies parse errors", () => {
    expect(classifyError(new Error("Invalid PDF structure")).type).toBe("parse");
    expect(classifyError(new Error("Unexpected token during parse")).type).toBe("parse");
  });

  it("falls back to unknown", () => {
    expect(classifyError(new Error("something weird happened")).type).toBe("unknown");
  });

  it("includes the url when provided", () => {
    const e = classifyError(new Error("timeout"), "https://example.gov/doc.pdf");
    expect(e.url).toBe("https://example.gov/doc.pdf");
  });

  it("handles non-Error values", () => {
    expect(classifyError("raw string error").type).toBe("unknown");
    expect(classifyError({ code: "ENOTFOUND" }).type).toBe("unknown");
  });
});
