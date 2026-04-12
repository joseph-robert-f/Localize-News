#!/usr/bin/env node
/**
 * Auto-expand the municipal directory using Claude.
 *
 * Reads the current MUNICIPAL_DIRECTORY to understand what's already covered,
 * reads expansion requests from data/expansion-requests.json, then asks Claude
 * to suggest new municipalities at the township / borough level. New entries
 * are appended to data/municipal-directory.ts.
 *
 * Usage:
 *   npx tsx scripts/auto-expand-directory.ts
 *   npx tsx scripts/auto-expand-directory.ts --focus "Carbon County, PA"
 *   npx tsx scripts/auto-expand-directory.ts --batch 30 --dry-run
 *
 * Options:
 *   --focus <area>    Override focus area for this run (bypasses requests file)
 *   --batch <n>       Number of municipalities to add (default: 25)
 *   --dry-run         Print what would be appended without modifying the file
 *
 * Required env var:
 *   ANTHROPIC_API_KEY
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Parse CLI args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const focusIdx = args.indexOf("--focus");
const cliFocus = focusIdx !== -1 ? args[focusIdx + 1] : undefined;
const batchIdx = args.indexOf("--batch");
const batchSize = batchIdx !== -1 ? parseInt(args[batchIdx + 1] ?? "25", 10) : 25;

// FOCUS_AREA env var allows GitHub Actions to pass a focus area via workflow input
const envFocus = process.env.FOCUS_AREA;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpansionRequest {
  area: string;
  description?: string;
  requested_by?: string;
  requested_at: string;
}

interface NewEntry {
  name: string;
  state: string;
  county?: string;
  website_url: string;
  population?: number;
  category: "city" | "township" | "borough" | "village";
  notes?: string;
}

// ── Validate env ──────────────────────────────────────────────────────────────

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("[auto-expand] Missing required env var: ANTHROPIC_API_KEY");
  process.exit(1);
}

// ── Load current directory ────────────────────────────────────────────────────

const { MUNICIPAL_DIRECTORY } = await import("../data/municipal-directory.js");

const existingSet = new Set(
  MUNICIPAL_DIRECTORY.map(
    (m: { name: string; state: string }) =>
      `${m.name.toLowerCase().trim()}|${m.state.toLowerCase().trim()}`
  )
);

// Group by state for a compact summary
const byState: Record<string, string[]> = {};
for (const m of MUNICIPAL_DIRECTORY as Array<{ name: string; state: string; county?: string }>) {
  (byState[m.state] ??= []).push(m.county ? `${m.name} (${m.county} Co.)` : m.name);
}

const coverageSummary = Object.entries(byState)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([state, names]) => `  ${state}: ${names.join(", ")}`)
  .join("\n");

// ── Load expansion requests ───────────────────────────────────────────────────

const requestsPath = path.join(ROOT, "data/expansion-requests.json");
let requests: ExpansionRequest[] = [];
if (existsSync(requestsPath)) {
  try {
    requests = JSON.parse(readFileSync(requestsPath, "utf-8"));
  } catch {
    console.warn("[auto-expand] Could not parse expansion-requests.json — continuing without it");
  }
}

// Resolve focus area: CLI arg > env var > first expansion request
const focusArea = cliFocus ?? envFocus ?? (requests.length > 0 ? requests[0].area : undefined);

const requestsBlock =
  requests.length > 0
    ? `\nUser-requested expansion areas (prioritise these):\n${requests
        .map((r) => `  - ${r.area}${r.description ? `: ${r.description}` : ""}`)
        .join("\n")}`
    : "";

const focusBlock = focusArea
  ? `\nFor this run, focus specifically on: ${focusArea}`
  : "";

console.log(`[auto-expand] Currently indexed: ${MUNICIPAL_DIRECTORY.length} municipalities`);
if (focusArea) console.log(`[auto-expand] Focus area: ${focusArea}`);
if (dryRun) console.log("[auto-expand] DRY RUN — file will not be modified\n");

// ── Build prompt ──────────────────────────────────────────────────────────────

const prompt = `You are expanding a database of US municipalities for a local government transparency platform that indexes public documents (agendas, meeting minutes, budgets, proposals).

## Already indexed (${MUNICIPAL_DIRECTORY.length} total)
${coverageSummary}
${requestsBlock}
${focusBlock}

## Your task
Suggest exactly ${batchSize} US municipalities that are NOT already in the list above.

Prioritisation rules:
1. If a focus area is given, fill it with townships and boroughs first — go to the hyper-local level (population 500–15,000).
2. Otherwise, suggest municipalities adjacent to or in the same county as existing entries.
3. Prefer township-level and borough-level entities (the most underserved tier for local government transparency).
4. Include county seats not yet covered.
5. Spread across different regions when no focus area is set.

Quality rules:
- Every entry must be a real, incorporated municipality with its own governing body that publishes public meeting documents.
- website_url must be the official government website (NOT Wikipedia, news sites, chamber of commerce, etc.).
- Prefer .gov domains. If the municipality uses a .com or .org, add a brief note.
- population should be the most recent Census estimate you know.
- category must be one of: "city", "township", "borough", "village"

## Output format
Return ONLY a valid JSON array — no markdown fences, no explanation text before or after. Example shape:
[
  {
    "name": "Upper Nazareth Township",
    "state": "PA",
    "county": "Northampton",
    "website_url": "https://uppernazarethtownship.org",
    "population": 6800,
    "category": "township",
    "notes": "Official site uses .org domain"
  }
]

If you are not confident in a website URL, omit the entry rather than guessing.`;

// ── Call Claude ───────────────────────────────────────────────────────────────

const client = new Anthropic();

console.log("[auto-expand] Calling Claude for suggestions…");

const response = await client.messages.create({
  model: "claude-opus-4-6",
  max_tokens: 4096,
  messages: [{ role: "user", content: prompt }],
});

const rawText =
  response.content[0].type === "text" ? response.content[0].text.trim() : "";

// Strip markdown fences if Claude included them despite instructions
const jsonText = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();

let suggestions: NewEntry[];
try {
  suggestions = JSON.parse(jsonText);
  if (!Array.isArray(suggestions)) throw new Error("Response is not an array");
} catch (err) {
  console.error("[auto-expand] Failed to parse Claude response as JSON:");
  console.error(rawText.slice(0, 500));
  process.exit(1);
}

console.log(`[auto-expand] Claude suggested ${suggestions.length} municipalities`);

// ── Deduplicate ───────────────────────────────────────────────────────────────

const newEntries = suggestions.filter((s) => {
  if (!s.name || !s.state || !s.website_url || !s.category) {
    console.warn(`[auto-expand] Skipping malformed entry: ${JSON.stringify(s)}`);
    return false;
  }
  const key = `${s.name.toLowerCase().trim()}|${s.state.toLowerCase().trim()}`;
  if (existingSet.has(key)) {
    console.log(`[auto-expand] Skip (already exists): ${s.name}, ${s.state}`);
    return false;
  }
  return true;
});

console.log(`[auto-expand] ${newEntries.length} new entries after deduplication`);

if (newEntries.length === 0) {
  console.log("[auto-expand] Nothing new to add — exiting");
  process.exit(0);
}

// ── Format as TypeScript ──────────────────────────────────────────────────────

function formatEntry(e: NewEntry): string {
  const lines: string[] = ["  {"];
  lines.push(`    name: ${JSON.stringify(e.name)},`);
  lines.push(`    state: ${JSON.stringify(e.state)},`);
  if (e.county) lines.push(`    county: ${JSON.stringify(e.county)},`);
  lines.push(`    website_url: ${JSON.stringify(e.website_url)},`);
  if (e.population) lines.push(`    population: ${e.population},`);
  lines.push(`    category: ${JSON.stringify(e.category)},`);
  if (e.notes) lines.push(`    notes: ${JSON.stringify(e.notes)},`);
  lines.push("  },");
  return lines.join("\n");
}

const runDate = new Date().toISOString().slice(0, 10);
const focusLabel = focusArea ? ` — focus: ${focusArea}` : "";
const sectionHeader = `\n  // ── Auto-expanded ${runDate}${focusLabel} ${"─".repeat(Math.max(0, 60 - runDate.length - focusLabel.length))}`;

const newBlock = [sectionHeader, ...newEntries.map(formatEntry)].join("\n");

// ── Append to file ────────────────────────────────────────────────────────────

const dirFilePath = path.join(ROOT, "data/municipal-directory.ts");
const original = readFileSync(dirFilePath, "utf-8");

// Insert just before the closing `];`
const insertionPoint = original.lastIndexOf("\n];");
if (insertionPoint === -1) {
  console.error("[auto-expand] Could not find closing `];` in municipal-directory.ts");
  process.exit(1);
}

const updated =
  original.slice(0, insertionPoint) + "\n" + newBlock + original.slice(insertionPoint);

if (dryRun) {
  console.log("\n── Would append ──────────────────────────────────────────────────────");
  console.log(newBlock);
  console.log("──────────────────────────────────────────────────────────────────────");
} else {
  writeFileSync(dirFilePath, updated, "utf-8");
  console.log(`[auto-expand] Wrote ${newEntries.length} new entries to data/municipal-directory.ts`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("\n── New entries ───────────────────────────────────────────────────────");
for (const e of newEntries) {
  console.log(`  [${e.category}] ${e.name}, ${e.state} (${e.county ?? "?"} Co.) — ${e.website_url}`);
}
console.log(`\n[auto-expand] Done — added ${newEntries.length} municipalities`);
console.log(`[auto-expand] Directory total: ${MUNICIPAL_DIRECTORY.length + newEntries.length}`);
