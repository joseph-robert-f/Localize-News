import { formatDate } from "@/lib/utils";

interface AreaInsightsCardProps {
  insights: string | null;
  updatedAt: string | null;
}

export function AreaInsightsCard({ insights, updatedAt }: AreaInsightsCardProps) {
  if (!insights) return null;

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-900/40 dark:bg-blue-950/30">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
          AI Area Insights
        </span>
        {updatedAt && (
          <span className="text-xs text-blue-400 dark:text-blue-500">
            Updated {formatDate(updatedAt)}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">
        {insights}
      </p>
    </div>
  );
}
