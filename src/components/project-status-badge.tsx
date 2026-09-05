import { Badge } from "@/components/ui/badge";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_VARIANT,
  PROJECT_STATUS_LABEL,
  type ProjectStatus,
} from "@/lib/project-status";

export {
  PROJECT_STATUSES,
  PROJECT_STATUS_VARIANT,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  PROJECT_STATUS_GROUP,
} from "@/lib/project-status";
export type { ProjectStatus } from "@/lib/project-status";

export function ProjectStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={PROJECT_STATUS_VARIANT[status] ?? "secondary"}>
      {PROJECT_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
