"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
      <div className="w-full max-w-sm text-center">
        <p className="mb-2 text-5xl font-bold text-zinc-300 dark:text-zinc-700">!</p>
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Something went wrong
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Link href="/">
            <Button variant="secondary">Home</Button>
          </Link>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-zinc-400">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
