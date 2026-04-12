import { formatDate } from "@/lib/utils";
import type { TownshipDocument } from "@/lib/db/types";

interface MeetingDigestProps {
  docs: TownshipDocument[];
}

export function MeetingDigest({ docs }: MeetingDigestProps) {
  if (docs.length === 0) return null;

  return (
    <div className="space-y-4">
      {docs.map((doc) => (
        <div
          key={doc.id}
          className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 capitalize">
              {doc.type}
            </span>
            {doc.date && (
              <span className="text-xs text-zinc-400">{formatDate(doc.date)}</span>
            )}
          </div>
          <p className="mb-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {doc.title}
          </p>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {doc.ai_summary}
          </p>
          <div className="mt-3 flex gap-3">
            {doc.file_url && (
              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                View PDF ↗
              </a>
            )}
            <a
              href={doc.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:underline"
            >
              Source ↗
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
