import { DocumentCard } from "./DocumentCard";
import type { TownshipDocument } from "@/lib/db/types";

interface DocumentListProps {
  documents: TownshipDocument[];
  emptyMessage?: string;
}

export function DocumentList({
  documents,
  emptyMessage = "No documents found.",
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {documents.map((doc) => (
        <li key={doc.id}>
          <DocumentCard doc={doc} />
        </li>
      ))}
    </ul>
  );
}
