import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate, truncate } from "@/lib/utils";
import type { TownshipDocument, DocumentType } from "@/lib/db/types";

interface DocumentCardProps {
  doc: TownshipDocument;
}

const typeConfig: Record<DocumentType, { label: string; variant: "info" | "default" | "success" | "warning" }> = {
  agenda:   { label: "Agenda",   variant: "info" },
  minutes:  { label: "Minutes",  variant: "default" },
  proposal: { label: "Proposal", variant: "warning" },
  budget:   { label: "Budget",   variant: "success" },
  other:    { label: "Other",    variant: "default" },
};

export function DocumentCard({ doc }: DocumentCardProps) {
  const { label, variant } = typeConfig[doc.type] ?? typeConfig.other;

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{doc.title}</CardTitle>
          {doc.date && (
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              {formatDate(doc.date)}
            </p>
          )}
        </div>
        <Badge variant={variant}>{label}</Badge>
      </CardHeader>

      {doc.content && (
        <CardBody>
          <p>{truncate(doc.content, 200)}</p>
        </CardBody>
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
          className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
        >
          Source
        </a>
      </div>
    </Card>
  );
}
