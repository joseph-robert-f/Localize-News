"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "@/lib/utils";
import type { Township } from "@/lib/db/types";

interface TownshipSearchProps {
  townships: Township[];
}

export function TownshipSearch({ townships }: TownshipSearchProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return townships;
    return townships.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.state.toLowerCase().includes(q)
    );
  }, [townships, query]);

  // Group by state
  const byState = useMemo(() => {
    return filtered.reduce<Record<string, Township[]>>((acc, t) => {
      (acc[t.state] ??= []).push(t);
      return acc;
    }, {});
  }, [filtered]);

  return (
    <div className="flex flex-col gap-6">
      {/* Search input */}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by township or state…"
          className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          No townships match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(byState)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([state, list]) => (
              <section key={state}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  {state}
                </h2>
                <ul className="flex flex-col gap-2">
                  {list.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/townships/${t.id}`}
                        className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {t.name}
                          </span>
                          <span className="text-sm text-zinc-500">{t.state}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          {t.last_scraped_at && (
                            <span className="hidden text-xs text-zinc-400 sm:block">
                              Updated {formatDate(t.last_scraped_at)}
                            </span>
                          )}
                          <StatusBadge status={t.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}

      {/* Footer count */}
      {query && (
        <p className="text-xs text-zinc-400">
          {filtered.length} of {townships.length} townships
        </p>
      )}
    </div>
  );
}
