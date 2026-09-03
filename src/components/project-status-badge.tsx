import { Badge } from "@/components/ui/badge";

export const PROJECT_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | null | undefined> = {
  ACTIVE: "default",
  COMPLETED: "success",
  ON_HOLD: "warning",
  CANCELLED: "destructive",
  DEAD: "destructive",
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
  CANCELLED: "Cancelled",
  DEAD: "Dead",
};

export function ProjectStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={PROJECT_STATUS_VARIANT[status] ?? "secondary"}>
      {PROJECT_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
