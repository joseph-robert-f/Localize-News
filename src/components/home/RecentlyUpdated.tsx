import Link from "next/link";
import { timeAgo } from "@/lib/utils";
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
          className="group flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
        >
          {/* State pill */}
          <span className="w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {t.state}
          </span>

          {/* Name */}
          <p className="font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-300 leading-snug">
            {t.name}
          </p>

          {/* Last updated */}
          {t.last_scraped_at && (
            <p className="mt-auto text-xs text-zinc-400">
              Updated {timeAgo(t.last_scraped_at)}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
