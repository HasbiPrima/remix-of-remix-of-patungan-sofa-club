import { statusLabel } from "@/lib/rules";
import type { GroupStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const styles: Record<GroupStatus, string> = {
  DP_BOOKING: "bg-warning/15 text-warning",
  PELUNASAN: "bg-accent/15 text-accent",
  LUNAS: "bg-primary/15 text-primary",
  SELESAI: "bg-success/15 text-success",
  BATAL: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status }: { status: GroupStatus }) {
  return <span className={cn("tag", styles[status])}>{statusLabel[status]}</span>;
}
