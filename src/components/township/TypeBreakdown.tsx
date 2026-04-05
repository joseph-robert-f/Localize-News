import { DOCUMENT_TYPES } from "@/lib/db/types";
import type { DocumentType } from "@/lib/db/types";

const TYPE_COLORS: Record<DocumentType, string> = {
  agenda:   "bg-blue-500",
  minutes:  "bg-green-500",
  budget:   "bg-amber-500",
  proposal: "bg-purple-500",
  other:    "bg-zinc-400",
};

const TYPE_LABELS: Record<DocumentType, string> = {
  agenda:   "Agendas",
  minutes:  "Minutes",
  budget:   "Budgets",
  proposal: "Proposals",
  other:    "Other",
};

interface TypeBreakdownProps {
  counts: Record<DocumentType, number>;
}

export function TypeBreakdown({ counts }: TypeBreakdownProps) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return <p className="text-sm text-zinc-400">No documents yet.</p>;
  }

  return (
    <div className="space-y-2.5">
      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        {DOCUMENT_TYPES.filter((t) => counts[t] > 0).map((type) => (
          <div
            key={type}
            className={TYPE_COLORS[type]}
            style={{ width: `${(counts[type] / total) * 100}%` }}
            title={`${TYPE_LABELS[type]}: ${counts[type]}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {DOCUMENT_TYPES.filter((t) => counts[t] > 0).map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${TYPE_COLORS[type]}`} />
            <span className="text-xs text-zinc-500">
              {TYPE_LABELS[type]}{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {counts[type]}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
