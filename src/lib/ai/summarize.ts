import Anthropic from "@anthropic-ai/sdk";

export const MIN_SUMMARIZABLE_LENGTH = 200;
const MAX_CONTENT_CHARS = 3_000;

/** Returns true if the document has enough content to be worth summarizing. */
export function isSummarizable(content: string | null): boolean {
  return content !== null && content.length >= MIN_SUMMARIZABLE_LENGTH;
}

/**
 * Generate a 2–3 sentence summary of a local government document using Claude Haiku.
 * Returns null if the content is unclear/too short or if Claude indicates it cannot summarize.
 */
export async function generateDocumentSummary(doc: {
  title: string;
  type: string;
  date: string | null;
  content: string;
}): Promise<string | null> {
  const excerpt = doc.content.slice(0, MAX_CONTENT_CHARS);

  // Instantiated here so missing ANTHROPIC_API_KEY fails at call time, not import time.
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    system:
      "You are summarizing local government documents for a public transparency platform. " +
      "Be factual and neutral. Respond only with the summary text — no preamble, no labels.",
    messages: [
      {
        role: "user",
        content:
          `Summarize this document in 2–3 sentences. Cover what was discussed or decided, ` +
          `any notable budget figures or policy changes, and the meeting context if available. ` +
          `If the content is too short or unclear to summarize meaningfully, respond with exactly: NULL\n\n` +
          `Title: ${doc.title}\nType: ${doc.type}\nDate: ${doc.date ?? "unknown"}\n\nContent:\n${excerpt}`,
      },
    ],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
  if (!text || text === "NULL") return null;
  return text;
}
