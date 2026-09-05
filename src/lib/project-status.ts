/**
 * Project status definitions shared between the badge component and the
 * server-side filtering / grouping logic. Kept in a separate `.ts` file so
 * unit tests can import these constants without pulling JSX into the test
 * runner (vitest.config.mts only includes `*.test.ts`).
 */

export const PROJECT_STATUSES = [
  "DRAFT",
  "ESTIMATE",
  "PENDING_APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "IN_PROGRESS",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | null | undefined
> = {
  DRAFT: "secondary",
  ESTIMATE: "outline",
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  SCHEDULED: "default",
  IN_PROGRESS: "default",
  ACTIVE: "default",
  ON_HOLD: "warning",
  COMPLETED: "success",
  CLOSED: "secondary",
  CANCELLED: "destructive",
  DEAD: "destructive",
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  ESTIMATE: "Estimate",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  DEAD: "Dead",
};

export const PROJECT_STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 border-gray-200",
  ESTIMATE: "bg-blue-50 text-blue-700 border-blue-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SCHEDULED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  IN_PROGRESS: "bg-sky-50 text-sky-700 border-sky-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ON_HOLD: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
  CLOSED: "bg-slate-100 text-slate-700 border-slate-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  DEAD: "bg-red-100 text-red-800 border-red-300",
};

export const PROJECT_STATUS_GROUP: Record<string, "planning" | "active" | "done"> = {
  DRAFT: "planning",
  ESTIMATE: "planning",
  PENDING_APPROVAL: "planning",
  APPROVED: "planning",
  SCHEDULED: "active",
  IN_PROGRESS: "active",
  ACTIVE: "active",
  ON_HOLD: "active",
  COMPLETED: "done",
  CLOSED: "done",
  CANCELLED: "done",
};
