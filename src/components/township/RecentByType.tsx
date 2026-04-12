import { DOCUMENT_TYPES } from "@/lib/db/types";
import type { DocumentType, TownshipDocument } from "@/lib/db/types";
import { formatDate } from "@/lib/utils";

const TYPE_LABELS: Record<DocumentType, string> = {
  agenda:   "Latest agenda",
  minutes:  "Latest minutes",
  budget:   "Latest budget",
  proposal: "Latest proposal",
  other:    "Latest other",
};

const TYPE_COLORS: Record<DocumentType, string> = {
  agenda:   "text-blue-600 dark:text-blue-400",
  minutes:  "text-green-600 dark:text-green-400",
  budget:   "text-amber-600 dark:text-amber-400",
  proposal: "text-purple-600 dark:text-purple-400",
  other:    "text-zinc-500",
};

interface RecentByTypeProps {
  recentByType: Partial<Record<DocumentType, TownshipDocument>>;
}

export function RecentByType({ recentByType }: RecentByTypeProps) {
  const entries = DOCUMENT_TYPES.filter((t) => recentByType[t]);

  if (entries.length === 0) {
    return <p className="text-sm text-zinc-400">No documents indexed yet.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((type) => {
        const doc = recentByType[type]!;
        const href = doc.file_url ?? doc.source_url;
        return (
          <a
            key={type}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
          >
            <span className={`text-xs font-semibold uppercase tracking-wide ${TYPE_COLORS[type]}`}>
              {TYPE_LABELS[type]}
            </span>
            <p className="text-sm font-medium text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-100 line-clamp-2">
              {doc.title}
            </p>
            {doc.date && (
              <p className="text-xs text-zinc-400">{formatDate(doc.date)}</p>
            )}
          </a>
        );
      })}
    </div>
  );
}
