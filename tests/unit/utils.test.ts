import { describe, it, expect } from "vitest";
import { formatDate, truncate, timeAgo, capitalise } from "@/lib/utils";

describe("formatDate", () => {
  it("formats a valid ISO date", () => {
    expect(formatDate("2026-04-04")).toMatch(/Apr 4, 2026/);
  });
  it("returns '—' for null", () => {
    expect(formatDate(null)).toBe("—");
  });
  it("returns '—' for invalid string", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("truncate", () => {
  it("leaves short strings unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  it("truncates long strings", () => {
    const result = truncate("hello world", 5);
    expect(result).toHaveLength(6); // 5 chars + '…'
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("capitalise", () => {
  it("capitalises the first letter", () => {
    expect(capitalise("agenda")).toBe("Agenda");
  });
  it("handles empty string", () => {
    expect(capitalise("")).toBe("");
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for very recent dates", () => {
    expect(timeAgo(new Date())).toBe("just now");
  });
  it("returns a minutes-ago string", () => {
    const d = new Date(Date.now() - 5 * 60 * 1000);
    expect(timeAgo(d)).toBe("5m ago");
  });
});
