import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
      <div className="text-center">
        <p className="mb-2 text-5xl font-bold text-zinc-300 dark:text-zinc-700">404</p>
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Page not found
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          That page doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
