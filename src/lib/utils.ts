import { clsx, type ClassValue } from "clsx";

/** Merge Tailwind classes conditionally. Use this everywhere instead of inline ternaries. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Format an ISO date string (or Date) to a human-readable short date, e.g. "Apr 4, 2026". */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  // Date-only strings (YYYY-MM-DD) are parsed as UTC midnight by spec, which shifts
  // to the prior calendar day in negative-offset timezones. Append T12:00:00 to treat
  // them as local noon so the displayed date always matches the stored date.
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
