"use server";

import { db } from "@/lib/db";
import { requireUser, isMissingColumnError, getActivePlan } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";
import { hasFeature } from "@/lib/plans";
import { coerceEnum } from "@/lib/utils";
import { TimeEntryStatus } from "@prisma/client";

export interface CreateTimeEntryInput {
  projectId: string;
  userId?: string;
  startTime: string;
  endTime?: string | null;
  duration?: number;
  description?: string | null;
  billable?: boolean;
  hourlyRate?: number;
  amount?: number;
  isManual?: boolean;
}

function secondsToHours(seconds: number): number {
  return seconds / 3600;
}

export async function createManualTimeEntry(input: CreateTimeEntryInput) {
  return withActionError("createManualTimeEntry", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const plan = await getActivePlan(user);
    if (!hasFeature(plan, "timeTracking")) {
      actionError("Time tracking is not available on your plan. Upgrade to unlock it.");
    }

    const userId = input["userId"] || user["id"];

    if (!input["projectId"]) actionError("Project is required.");

    const projectExists = await db["project"]["findFirst"]({
      where: { id: input["projectId"], orgId },
      select: { id: true },
    });
    if (!projectExists) actionError("Selected project does not exist.");

    let duration = input["duration"];
    if (!duration && input["startTime"] && input["endTime"]) {
      duration = (new Date(input["endTime"])["getTime"]() - new Date(input["startTime"])["getTime"]()) / 1000;
    }
    if (!duration) duration = 0;

    const hours = secondsToHours(duration);
    const hourlyRate = input["hourlyRate"] ?? 0;
    const amount = hours * hourlyRate;

    try {
      const entry = await db["timeEntry"]["create"]({
        data: {
          orgId,
          userId,
          projectId: input["projectId"],
          startTime: new Date(input["startTime"]),
          endTime: input["endTime"] ? new Date(input["endTime"]) : null,
          duration,
          description: input["description"] || null,
          billable: input["billable"] ?? true,
          hourlyRate,
          amount,
          isManual: true,
          status: "APPROVED" as TimeEntryStatus,
        },
      });
      await revalidateWithLocale("/dashboard/time-tracking");
      return entry;
    } catch (err) {
      if (isMissingColumnError(err)) {
        actionError("Time tracking tables are not fully migrated. Please run pending migrations.");
      }
      throw err;
    }
  });
}

export async function getTimeEntries(params?: {
  userId?: string;
  projectId?: string;
  invoiceId?: string | null;
  status?: string;
  billable?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}) {
  return withActionError("getTimeEntries", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const where: Record<string, any> = { orgId };
    if (params?.["userId"]) where["userId"] = params["userId"];
    if (params?.["projectId"]) where["projectId"] = params["projectId"];
    if (params?.["invoiceId"]) where["invoiceId"] = params["invoiceId"];
    else if (params?.["invoiceId"] === null) where["invoiceId"] = null;
    if (params?.["status"]) where["status"] = params["status"];
    if (params?.["billable"] !== undefined) where["billable"] = params["billable"];
    if (params?.["dateFrom"] || params?.["dateTo"]) {
      const from = params?.["dateFrom"];
      const to = params?.["dateTo"];
      where["startTime"] = {};
      if (from) where["startTime"]["gte"] = new Date(from);
      if (to) where["startTime"]["lte"] = new Date(to);
    }

    try {
      const entries = await db["timeEntry"]["findMany"]({
        where,
        orderBy: { startTime: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
          invoice: { select: { id: true, number: true } },
        },
        take: params?.["limit"] ?? undefined,
      });
      return entries;
    } catch (err) {
      if (isMissingColumnError(err)) {
        return [];
      }
      throw err;
    }
  });
}

export async function getTimeEntry(id: string) {
  return withActionError("getTimeEntry", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    try {
      const entry = await db["timeEntry"]["findFirst"]({
        where: { id, orgId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true, customerId: true, customer: { select: { name: true } } } },
          invoice: { select: { id: true, number: true } },
        },
      });
      if (!entry) actionError("Time entry not found");
      return entry;
    } catch (err) {
      if (isMissingColumnError(err)) {
        actionError("Time tracking tables are not fully migrated.");
      }
      throw err;
    }
  });
}

export async function updateTimeEntry(id: string, input: Partial<CreateTimeEntryInput> & { status?: TimeEntryStatus; isFavorite?: boolean }) {
  return withActionError("updateTimeEntry", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const existing = await db["timeEntry"]["findFirst"]({
      where: { id, orgId },
      select: { id: true },
    });
    if (!existing) actionError("Time entry not found");

    let duration = input["duration"];
    if (!duration && input["startTime"] && input["endTime"]) {
      duration = (new Date(input["endTime"])["getTime"]() - new Date(input["startTime"])["getTime"]()) / 1000;
    }

    let amount = undefined;
    if ((duration !== undefined && input["hourlyRate"] !== undefined) || input["amount"] !== undefined) {
      if (input["amount"] !== undefined) {
        amount = input["amount"];
      } else if (duration && input["hourlyRate"] !== undefined) {
        amount = secondsToHours(duration) * input["hourlyRate"];
      }
    }

    const data: Record<string, any> = {
      ...(input["description"] !== undefined && { description: input["description"] }),
      ...(input["billable"] !== undefined && { billable: input["billable"] }),
      ...(input["hourlyRate"] !== undefined && { hourlyRate: input["hourlyRate"] }),
      ...(amount !== undefined && { amount }),
      ...(input["projectId"] !== undefined && { projectId: input["projectId"] }),
      ...(input["userId"] !== undefined && { userId: input["userId"] }),
      ...(input["startTime"] !== undefined && { startTime: new Date(input["startTime"]) }),
      ...(input["endTime"] !== undefined && { endTime: input["endTime"] ? new Date(input["endTime"]) : null }),
      ...(duration !== undefined && { duration }),
      ...(input["isManual"] !== undefined && { isManual: input["isManual"] }),
      ...(input["status"] !== undefined && {
        status: coerceEnum(input["status"], TimeEntryStatus, "status"),
      }),
    };

    try {
      const entry = await db["timeEntry"]["update"]({
        where: { id, orgId },
        data,
      });
      await revalidateWithLocale("/dashboard/time-tracking");
      return entry;
    } catch (err) {
      if (isMissingColumnError(err)) {
        actionError("Time tracking tables are not fully migrated.");
      }
      throw err;
    }
  });
}

export async function deleteTimeEntry(id: string) {
  return withActionError("deleteTimeEntry", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const existing = await db["timeEntry"]["findFirst"]({
      where: { id, orgId },
      select: { id: true },
    });
    if (!existing) actionError("Time entry not found");

    try {
      await db["timeEntry"]["delete"]({ where: { id, orgId } });
    } catch (err) {
      if (isMissingColumnError(err)) {
        actionError("Time tracking tables are not fully migrated.");
      }
      throw err;
    }

    await revalidateWithLocale("/dashboard/time-tracking");
    return { success: true, id };
  });
}

export async function approveTimeEntries(ids: string[]) {
  return withActionError("approveTimeEntries", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    try {
      await db["timeEntry"]["updateMany"]({
        where: { id: { in: ids }, orgId },
        data: { status: "APPROVED" as TimeEntryStatus },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        actionError("Time tracking tables are not fully migrated.");
      }
      throw err;
    }

    await revalidateWithLocale("/dashboard/time-tracking");
    return { success: true, count: ids["length"] };
  });
}

export async function getTimeEntriesForInvoice(params: {
  userId?: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return withActionError("getTimeEntriesForInvoice", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const where: Record<string, any> = {
      orgId,
      billable: true,
      status: "APPROVED" as TimeEntryStatus,
      invoiceId: null,
    };
    if (params?.["userId"]) where["userId"] = params["userId"];
    if (params?.["projectId"]) where["projectId"] = params["projectId"];
    if (params?.["dateFrom"] || params?.["dateTo"]) {
      const from = params?.["dateFrom"];
      const to = params?.["dateTo"];
      where["startTime"] = {};
      if (from) where["startTime"]["gte"] = new Date(from);
      if (to) where["startTime"]["lte"] = new Date(to);
    }

    try {
      const entries = await db["timeEntry"]["findMany"]({
        where,
        orderBy: { startTime: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          project: {
            select: {
              id: true,
              name: true,
              customerId: true,
              customer: { select: { name: true } },
            },
          },
        },
      });
      return entries;
    } catch (err) {
      if (isMissingColumnError(err)) {
        return [];
      }
      throw err;
    }
  });
}

export async function setTimeEntryInvoice(entryId: string, invoiceId: string) {
  return withActionError("setTimeEntryInvoice", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    try {
      const entry = await db["timeEntry"]["update"]({
        where: { id: entryId, orgId },
        data: {
          invoiceId,
          status: "INVOICED" as TimeEntryStatus,
        },
      });
      await revalidateWithLocale("/dashboard/time-tracking");
      return entry;
    } catch (err) {
      if (isMissingColumnError(err)) {
        actionError("Time tracking tables are not fully migrated.");
      }
      throw err;
    }
  });
}

export interface TimeEntryWithRelations {
  id: string;
  orgId: string;
  userId: string;
  projectId: string;
  invoiceId: string | null;
  startTime: Date;
  endTime: Date | null;
  duration: number;
  description: string | null;
  billable: boolean;
  hourlyRate: number;
  amount: number;
  isManual: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; name: string | null; email: string | null };
  project?: { id: string; name: string; customerId: string | null; customer?: { name: string | null } };
  invoice?: { id: string; number: string | null };
}
