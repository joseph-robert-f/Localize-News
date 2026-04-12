import Link from "next/link";
import { timeAgo, formatLocation } from "@/lib/utils";
import type { Township } from "@/lib/db/types";

interface RecentlyUpdatedProps {
  townships: Township[];
}

export function RecentlyUpdated({ townships }: RecentlyUpdatedProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {townships.map((t) => (
        <Link
          key={t.id}
          href={`/townships/${t.id}`}
          className="group flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-5 transition-all hover:border-stone-400 hover:shadow-sm dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-600"
        >
          {/* Category + state pill */}
          <span className="w-fit rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-400">
            {t.state}
          </span>

          {/* Name */}
          <p className="font-semibold text-stone-900 group-hover:text-stone-700 dark:text-stone-100 dark:group-hover:text-stone-300 leading-snug">
            {t.name}
          </p>

          {/* Location hierarchy */}
          <p className="text-xs text-stone-400 leading-snug">
            {formatLocation(t)}
          </p>

          {/* Last updated */}
          {t.last_scraped_at && (
            <p className="mt-auto text-xs text-stone-400">
              Updated {timeAgo(t.last_scraped_at)}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
