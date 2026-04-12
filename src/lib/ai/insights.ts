import Anthropic from "@anthropic-ai/sdk";
import type { TownshipDocument } from "../db/types";

const MAX_DOCS = 10;
const MAX_EXCERPT_CHARS = 1_000;

/**
 * Generate a township-level area insight by synthesizing recent documents.
 *
 * Uses existing ai_summary fields where available; falls back to raw content excerpts.
 * Returns null if there aren't enough documents to analyze meaningfully (< 2 usable).
 *
 * This is distinct from per-document summaries (documents.ai_summary): those are
 * single-document Claude Haiku calls. This is a cross-document synthesis — "what's
 * been happening in this area recently."
 */
export async function generateAreaInsights(
  townshipName: string,
  state: string,
  docs: Pick<TownshipDocument, "title" | "type" | "date" | "content" | "ai_summary">[]
): Promise<string | null> {
  const usable = docs
    .filter((d) => d.content || d.ai_summary)
    .slice(0, MAX_DOCS);

  if (usable.length < 2) return null;

  const excerpts = usable
    .map((d, i) => {
      const text = d.ai_summary ?? d.content!.slice(0, MAX_EXCERPT_CHARS);
      return `[${i + 1}] ${d.type.toUpperCase()} — ${d.title} (${d.date ?? "undated"})\n${text}`;
    })
    .join("\n\n---\n\n");

  // Instantiated here so missing ANTHROPIC_API_KEY fails at call time, not import time.
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    system:
      "You are analyzing local government records for a public transparency platform. " +
      "Be factual, neutral, and concise. Respond only with the analysis — no preamble or labels.",
    messages: [
      {
        role: "user",
        content:
          `Based on these recent public documents from ${townshipName}, ${state}, write a brief area insight (3–5 sentences). ` +
          `Cover: key topics being discussed, any recurring issues or themes, notable decisions or budget items, and the general governance focus. ` +
          `If the content is insufficient to draw meaningful conclusions, respond with exactly: NULL\n\n` +
          excerpts,
      },
    ],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
  if (!text || text === "NULL") return null;
  return text;
}
