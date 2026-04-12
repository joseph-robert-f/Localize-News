import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate, truncate } from "@/lib/utils";
import type { TownshipDocument, DocumentType } from "@/lib/db/types";
import { cn } from "@/lib/utils";

interface DocumentCardProps {
  doc: TownshipDocument;
  /** When shown on a cross-township search page, display the township name. */
  townshipName?: string;
  townshipState?: string;
}

const typeConfig: Record<DocumentType, { label: string; variant: "info" | "default" | "success" | "warning" }> = {
  agenda:   { label: "Agenda",   variant: "info" },
  minutes:  { label: "Minutes",  variant: "default" },
  proposal: { label: "Proposal", variant: "warning" },
  budget:   { label: "Budget",   variant: "success" },
  other:    { label: "Other",    variant: "default" },
};

export function DocumentCard({ doc, townshipName, townshipState }: DocumentCardProps) {
  const { label, variant } = typeConfig[doc.type] ?? typeConfig.other;

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <Link href={`/documents/${doc.id}`} className="hover:underline">
            <CardTitle>{doc.title}</CardTitle>
          </Link>
          <div className="flex items-center gap-2">
            {doc.date && (
              <p className="text-xs text-stone-500 dark:text-stone-500">
                {formatDate(doc.date)}
              </p>
            )}
            {townshipName && (
              <>
                {doc.date && <span className="text-xs text-stone-300 dark:text-stone-600">·</span>}
                <Link
                  href={`/townships/${doc.township_id}`}
                  className="text-xs text-stone-500 hover:underline dark:text-stone-400"
                >
                  {townshipName}{townshipState ? `, ${townshipState}` : ""}
                </Link>
              </>
            )}
          </div>
        </div>
        <Badge variant={variant}>{label}</Badge>
      </CardHeader>

      {(doc.ai_summary ?? doc.content) && (
        <CardBody>
          <p
            className={
              doc.ai_summary
                ? "text-sm text-stone-600 dark:text-stone-400 leading-relaxed"
                : ""
            }
          >
            {doc.ai_summary ?? truncate(doc.content!, 200)}
          </p>
          {doc.ai_summary && (
            <p className="mt-1 text-xs text-stone-400">AI summary</p>
          )}
        </CardBody>
      )}

      {doc.topics && doc.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {doc.topics.slice(0, 5).map((topic) => (
            <Link
              key={topic}
              href={`/search?q=${encodeURIComponent(topic)}`}
              className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
            >
              {topic}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-3 pt-2">
        {doc.file_url && (
          <a
            href={doc.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            View PDF
          </a>
        )}
        <a
          href={doc.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-stone-500 hover:underline dark:text-stone-400"
        >
          Source
        </a>
      </div>
    </Card>
  );
}
