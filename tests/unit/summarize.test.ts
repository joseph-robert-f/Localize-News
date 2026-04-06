import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted runs before vi.mock hoisting, making mockCreate available inside the factory
const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  return { mockCreate };
});

vi.mock("@anthropic-ai/sdk", () => ({
  // Use a regular function (not arrow) so `new Anthropic()` works as a constructor
  default: vi.fn(function () {
    return { messages: { create: mockCreate } };
  }),
}));

import { generateDocumentSummary, isSummarizable, MIN_SUMMARIZABLE_LENGTH } from "../../src/lib/ai/summarize";

const SAMPLE_DOC = {
  title: "City Council Meeting Agenda",
  type: "agenda",
  date: "2026-03-15",
  content: "A".repeat(300), // sufficient length
};

describe("isSummarizable", () => {
  it("returns false for null content", () => {
    expect(isSummarizable(null)).toBe(false);
  });

  it("returns false for content shorter than MIN_SUMMARIZABLE_LENGTH", () => {
    expect(isSummarizable("A".repeat(MIN_SUMMARIZABLE_LENGTH - 1))).toBe(false);
  });

  it("returns true for content at MIN_SUMMARIZABLE_LENGTH", () => {
    expect(isSummarizable("A".repeat(MIN_SUMMARIZABLE_LENGTH))).toBe(true);
  });

  it("returns true for content longer than MIN_SUMMARIZABLE_LENGTH", () => {
    expect(isSummarizable("A".repeat(500))).toBe(true);
  });
});

describe("generateDocumentSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns summary text when API responds with valid text", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "This is a summary of the meeting." }],
    });

    const result = await generateDocumentSummary(SAMPLE_DOC);
    expect(result).toBe("This is a summary of the meeting.");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("returns null when API responds with exactly NULL", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "NULL" }],
    });

    const result = await generateDocumentSummary(SAMPLE_DOC);
    expect(result).toBeNull();
  });

  it("returns null when API returns empty content array", async () => {
    mockCreate.mockResolvedValueOnce({ content: [] });

    const result = await generateDocumentSummary(SAMPLE_DOC);
    expect(result).toBeNull();
  });

  it("returns null when API returns non-text content block", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "x", name: "foo", input: {} }],
    });

    const result = await generateDocumentSummary(SAMPLE_DOC);
    expect(result).toBeNull();
  });

  it("trims whitespace from the returned summary", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "  Trimmed summary.  " }],
    });

    const result = await generateDocumentSummary(SAMPLE_DOC);
    expect(result).toBe("Trimmed summary.");
  });

  it("propagates API errors to the caller", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API rate limit exceeded"));

    await expect(generateDocumentSummary(SAMPLE_DOC)).rejects.toThrow(
      "API rate limit exceeded"
    );
  });

  it("uses 'unknown' in the prompt when doc.date is null", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Summary without date." }],
    });

    const result = await generateDocumentSummary({ ...SAMPLE_DOC, date: null });
    expect(result).toBe("Summary without date.");

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain("Date: unknown");
  });
});
