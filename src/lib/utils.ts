import { clsx, type ClassValue } from "clsx";

/** Merge Tailwind classes conditionally. Use this everywhere instead of inline ternaries. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Format an ISO date string (or Date) to a human-readable short date, e.g. "Apr 4, 2026". */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  // Append T12:00:00 for date-only strings to avoid UTC midnight → previous-day shift
  const d =
    typeof value === "string"
      ? /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(value + "T12:00:00")
        : new Date(value)
      : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Truncate a string to maxLength chars, appending "…" if needed. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

/** Return a relative time string like "3 days ago" or "just now". */
export function timeAgo(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

/** Capitalise the first letter of a string. */
export function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Geographic taxonomy helpers ───────────────────────────────────────────────

/**
 * Human-readable label for a municipality's category.
 * "city" → "City", "township" → "Township", etc.
 */
export function formatCategory(category: string | null | undefined): string {
  if (!category) return "Municipality";
  const map: Record<string, string> = {
    city:     "City",
    township: "Township",
    borough:  "Borough",
    village:  "Village",
    town:     "Town",
  };
  return map[category] ?? capitalise(category);
}

/**
 * The correct term for a county-equivalent subdivision in a given state.
 * Louisiana uses "Parish"; Alaska uses "Borough" for its county-equivalents;
 * everywhere else uses "County".
 */
export function countyLabel(state: string): string {
  if (state === "LA") return "Parish";
  if (state === "AK") return "Borough";
  return "County";
}

/**
 * One-line location string for display beneath a municipality name.
 * Examples:
 *   "Township · Northampton County, PA"
 *   "City · Franklin Parish, LA"
 *   "Borough · Anchorage Borough, AK"
 *   "City · Ohio"  (no county data)
 */
export function formatLocation(t: {
  state: string;
  county?: string | null;
  category?: string | null;
}): string {
  const cat = formatCategory(t.category);
  const cl  = countyLabel(t.state);
  if (t.county) return `${cat} · ${t.county} ${cl}, ${t.state}`;
  return `${cat} · ${t.state}`;
}

/**
 * Short breadcrumb fragments for a municipality.
 * Returns an array so callers can render separators between them.
 * e.g. ["PA", "Northampton County", "Wind Gap Borough"]
 */
export function locationBreadcrumbs(t: {
  name: string;
  state: string;
  county?: string | null;
  category?: string | null;
}): string[] {
  const parts: string[] = [t.state];
  if (t.county) parts.push(`${t.county} ${countyLabel(t.state)}`);
  parts.push(`${t.name} ${formatCategory(t.category)}`);
  return parts;
}
