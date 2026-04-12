import Link from "next/link";

interface SiteHeaderProps {
  /** true = inner pages (slim wordmark); false = home page (full brand + tagline) */
  slim?: boolean;
  /** If set, shows a "← label" back link on the left of a slim header */
  backHref?: string;
  backLabel?: string;
  /** Content rendered on the right side */
  rightSlot?: React.ReactNode;
}

const BellIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export function SiteHeader({
  slim = false,
  backHref,
  backLabel = "All townships",
  rightSlot,
}: SiteHeaderProps) {
  return (
    <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        {slim ? (
          /* Slim header: back link or wordmark on left */
          <div className="flex items-center gap-4">
            {backHref ? (
              <Link
                href={backHref}
                className="text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
              >
                ← {backLabel}
              </Link>
            ) : (
              <Link
                href="/"
                className="flex items-center gap-1.5 text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100 font-[family-name:var(--font-display)]"
              >
                <BellIcon />
                Town Crier
              </Link>
            )}
          </div>
        ) : (
          /* Full brand header: bell + name + tagline on left */
          <div>
            <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100">
              <BellIcon />
              <span className="text-lg font-bold tracking-tight font-[family-name:var(--font-display)]">
                Town Crier
              </span>
            </div>
            <p className="text-xs text-stone-500">Local government, loudly indexed</p>
          </div>
        )}

        {rightSlot && (
          <div className="flex items-center gap-3">{rightSlot}</div>
        )}
      </div>
    </header>
  );
}
