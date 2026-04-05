"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DocumentCard } from "./DocumentCard";
import type { TownshipDocument, DocumentType } from "@/lib/db/types";

interface LoadMoreProps {
  townshipId: string;
  type?: DocumentType;
  initialCursor: string | null;
}

export function LoadMore({ townshipId, type, initialCursor }: LoadMoreProps) {
  const [docs, setDocs] = useState<TownshipDocument[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    setError("");

    try {
      const url = new URL(`/api/townships/${townshipId}/documents`, window.location.origin);
      if (type) url.searchParams.set("type", type);
      url.searchParams.set("cursor", cursor);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      setDocs((prev) => [...prev, ...data.documents]);
      setCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more.");
    } finally {
      setLoading(false);
    }
  }

  if (docs.length === 0 && !cursor) return null;

  return (
    <>
      {docs.length > 0 && (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <li key={doc.id}>
              <DocumentCard doc={doc} />
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button variant="secondary" loading={loading} onClick={loadMore}>
            Load more
          </Button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </>
  );
}
