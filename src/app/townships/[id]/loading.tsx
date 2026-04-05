export default function TownshipLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header skeleton */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Township name skeleton */}
        <div className="mb-8">
          <div className="mb-2 h-7 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>

        {/* Filter tabs skeleton */}
        <div className="mb-6 flex gap-2">
          {[80, 60, 70, 64, 56, 60].map((w, i) => (
            <div
              key={i}
              className="h-7 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700"
              style={{ width: w }}
            />
          ))}
        </div>

        {/* Document cards skeleton */}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 h-4 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="mb-4 h-3 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-3 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                <div className="mt-1 h-3 w-5/6 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
