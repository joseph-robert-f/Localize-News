import Anthropic from "@anthropic-ai/sdk";

const MAX_CONTENT_CHARS = 2_000;

/**
 * Extract 3–6 topic tags from a local government document using Claude Haiku.
 *
 * Tags are lowercase, 1–3 words, standardized for filtering — e.g. "zoning",
 * "road maintenance", "public safety". Returns null if the content is too
 * short/unclear to tag meaningfully.
 */
export async function generateDocumentTopics(doc: {
  title: string;
  type: string;
  date: string | null;
  content: string;
}): Promise<string[] | null> {
  const excerpt = doc.content.slice(0, MAX_CONTENT_CHARS);

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 128,
    system:
      "You extract topic tags from local government documents. " +
      "Respond ONLY with a JSON array — no explanation, no markdown. Example: [\"zoning\",\"budget\",\"road maintenance\"]",
    messages: [
      {
        role: "user",
        content:
          `Extract 3–6 topic tags from this local government document. ` +
          `Tags must be lowercase, 1–3 words, and useful for filtering government records ` +
          `(e.g. "zoning", "tax increase", "water infrastructure", "public safety", "school funding"). ` +
          `Return ONLY a JSON array of strings. If the document is too short or unclear, return: null\n\n` +
          `Title: ${doc.title}\nType: ${doc.type}\nDate: ${doc.date ?? "unknown"}\n\nContent:\n${excerpt}`,
      },
    ],
  });

  const raw =
    response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
  if (!raw || raw === "null") return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const tags = parsed
      .filter((t): t is string => typeof t === "string" && t.length > 0)
      .map((t) => t.toLowerCase().trim())
      .slice(0, 8); // hard cap to prevent runaway output
    return tags.length > 0 ? tags : null;
  } catch {
    return null;
  }
}
