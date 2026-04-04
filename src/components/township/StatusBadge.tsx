import { Badge } from "@/components/ui/Badge";
import type { TownshipStatus } from "@/lib/db/types";

interface StatusBadgeProps {
  status: TownshipStatus;
}

const config: Record<TownshipStatus, { variant: "success" | "warning" | "error" | "default"; label: string }> = {
  active:      { variant: "success", label: "Active" },
  pending:     { variant: "warning", label: "Pending" },
  error:       { variant: "error",   label: "Error" },
  unsupported: { variant: "default", label: "Unsupported" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { variant, label } = config[status] ?? config.unsupported;
  return <Badge variant={variant}>{label}</Badge>;
}
