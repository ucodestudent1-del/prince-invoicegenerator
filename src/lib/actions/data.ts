"use server";

import { db } from "@/lib/db";
import { requireUser, isMissingColumnError } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";

type ActionResult = { count: number };

async function requireOrgAdmin() {
  const user = await requireUser();
  if (!user["organizationId"]) actionError("No organization");
  if (user["role"] !== "OWNER" && user["role"] !== "ADMIN") {
    actionError("Only owners and admins can manage organization data.");
  }
  return { userId: user["id"], orgId: user["organizationId"] };
}

async function revalidateOrg() {
  const paths = [
    "/dashboard",
    "/dashboard/invoices",
    "/dashboard/estimates",
    "/dashboard/change-orders",
    "/dashboard/projects",
    "/dashboard/expenses",
    "/dashboard/customers",
    "/dashboard/team",
    "/dashboard/subcontractors",
    "/dashboard/settings",
  ];
  for (const p of paths) await revalidateWithLocale(p);
}

function pluckIds(rows: { id: string }[]) {
  return rows["map"]((r) => r["id"]);
}

export async function removeAllInvoices(): Promise<ActionResult> {
  return withActionError("removeAllInvoices", async () => {
    const { orgId } = await requireOrgAdmin();

    const invoices = await db["invoice"]["findMany"]({
      where: { orgId },
      select: { id: true },
    });
    const invoiceIds = pluckIds(invoices);

    await db["$transaction"](async (tx) => {
      if (invoiceIds["length"]) {
        // Drop references that point at the invoices so removal cannot be
        // blocked by a non-cascading foreign key.
        await tx["changeOrder"]["updateMany"]({
          where: { orgId, invoiceId: { in: invoiceIds } },
          data: { invoiceId: null },
        });
        await tx["invoiceItem"]["deleteMany"]({
          where: { invoiceId: { in: invoiceIds } },
        });
        await tx["recurringInvoiceConfig"]["updateMany"]({
          where: { lastInvoiceId: { in: invoiceIds } },
          data: { lastInvoiceId: null },
        });
      }
      await tx["invoice"]["deleteMany"]({ where: { orgId } });
    });

    await revalidateOrg();
    return { count: invoiceIds["length"] };
  });
}

export async function removeAllEstimates(): Promise<ActionResult> {
  return withActionError("removeAllEstimates", async () => {
    const { orgId } = await requireOrgAdmin();

    const estimates = await db["estimate"]["findMany"]({
      where: { orgId },
      select: { id: true },
    });
    const estimateIds = pluckIds(estimates);

    await db["$transaction"](async (tx) => {
      if (estimateIds["length"]) {
        await tx["estimateItem"]["deleteMany"]({
          where: { estimateId: { in: estimateIds } },
        });
      }
      await tx["estimate"]["deleteMany"]({ where: { orgId } });
    });

    await revalidateOrg();
    return { count: estimateIds["length"] };
  });
}

export async function removeAllChangeOrders(): Promise<ActionResult> {
  return withActionError("removeAllChangeOrders", async () => {
    const { orgId } = await requireOrgAdmin();
    const res = await db["changeOrder"]["deleteMany"]({ where: { orgId } });
    await revalidateOrg();
    return { count: res["count"] };
  });
}

export async function removeAllExpenses(): Promise<ActionResult> {
  return withActionError("removeAllExpenses", async () => {
    const { orgId } = await requireOrgAdmin();
    const res = await db["expense"]["deleteMany"]({ where: { orgId } });
    await revalidateOrg();
    return { count: res["count"] };
  });
}

export async function removeAllProjects(): Promise<ActionResult> {
  return withActionError("removeAllProjects", async () => {
    const { orgId } = await requireOrgAdmin();

    const projects = await db["project"]["findMany"]({
      where: { orgId },
      select: { id: true },
    });
    const projectIds = pluckIds(projects);

    await db["$transaction"](async (tx) => {
      if (projectIds["length"]) {
        // SubcontractorProject is the junction table and has no orgId column.
        await tx["subcontractorProject"]["deleteMany"]({
          where: { projectId: { in: projectIds } },
        });
      }
      await tx["project"]["deleteMany"]({ where: { orgId } });
    });

    await revalidateOrg();
    return { count: projectIds["length"] };
  });
}

export async function removeAllSubcontractors(): Promise<ActionResult> {
  return withActionError("removeAllSubcontractors", async () => {
    const { orgId } = await requireOrgAdmin();

    const subs = await db["subcontractor"]["findMany"]({
      where: { orgId },
      select: { id: true },
    });
    const subIds = pluckIds(subs);

    await db["$transaction"](async (tx) => {
      if (subIds["length"]) {
        await tx["subcontractorProject"]["deleteMany"]({
          where: { subcontractorId: { in: subIds } },
        });
      }
      await tx["subcontractor"]["deleteMany"]({ where: { orgId } });
    });

    await revalidateOrg();
    return { count: subIds["length"] };
  });
}

export async function removeAllCustomers(): Promise<ActionResult> {
  return withActionError("removeAllCustomers", async () => {
    const { orgId } = await requireOrgAdmin();

    const customerCount = await db["customer"]["count"]({ where: { orgId } });

    // Customers are referenced by invoices, estimates and recurring configs
    // via foreign keys. The database cascades those on delete, but we also
    // remove them explicitly first so the operation succeeds even where
    // cascade actions are not configured. All queries are scoped to orgId.
    await db["$transaction"](async (tx) => {
      await tx["recurringInvoiceConfig"]["deleteMany"]({ where: { orgId } });
      await tx["invoice"]["deleteMany"]({ where: { orgId } });
      await tx["estimate"]["deleteMany"]({ where: { orgId } });
      await tx["project"]["updateMany"]({
        where: { orgId, customerId: { not: null } },
        data: { customerId: null },
      });
      await tx["customer"]["deleteMany"]({ where: { orgId } });
    });

    await revalidateOrg();
    return { count: customerCount };
  });
}

export async function removeAllTeamMembers(): Promise<ActionResult> {
  return withActionError("removeAllTeamMembers", async () => {
    const { orgId, userId } = await requireOrgAdmin();

    const res = await db["user"]["updateMany"]({
      where: { organizationId: orgId, id: { not: userId } },
      data: { organizationId: null },
    });

    await revalidateOrg();
    return { count: res["count"] };
  });
}

export async function deleteOrganization(): Promise<ActionResult> {
  return withActionError("deleteOrganization", async () => {
    const { orgId, userId } = await requireOrgAdmin();

    try {
      await db["$transaction"](async (tx) => {
        await tx["invoiceAudit"]["deleteMany"]({ where: { orgId } });
        await tx["payment"]["deleteMany"]({ where: { orgId } });
        await tx["reminder"]["deleteMany"]({ where: { orgId } });
        await tx["reminderConfig"]["deleteMany"]({ where: { orgId } });
        await tx["lateFeeConfig"]["deleteMany"]({ where: { orgId } });
        await tx["recurringInvoiceConfig"]["deleteMany"]({ where: { orgId } });
        await tx["invoiceItem"]["deleteMany"]({
          where: { invoice: { orgId } },
        } as any);
        await tx["invoice"]["deleteMany"]({ where: { orgId } });
        await tx["estimateItem"]["deleteMany"]({
          where: { estimate: { orgId } },
        } as any);
        await tx["estimate"]["deleteMany"]({ where: { orgId } });
        await tx["changeOrder"]["deleteMany"]({ where: { orgId } });
        await tx["expense"]["deleteMany"]({ where: { orgId } });
        await tx["project"]["deleteMany"]({ where: { orgId } });
        await tx["subcontractorProject"]["deleteMany"]({
          where: {
            project: { orgId },
          } as any,
        });
        await tx["subcontractor"]["deleteMany"]({ where: { orgId } });
        await tx["customerAddress"]["deleteMany"]({ where: { orgId } });
        await tx["customer"]["deleteMany"]({ where: { orgId } });
        await tx["photoAttachment"]["deleteMany"]({ where: { orgId } });
        await tx["user"]["updateMany"]({
          where: { organizationId: orgId, id: { not: userId } },
          data: { organizationId: null },
        });
        await tx["organization"]["delete"]({ where: { id: orgId }, select: { id: true } });
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        await db["$transaction"](async (tx) => {
          await tx["invoice"]["deleteMany"]({ where: { orgId } });
          await tx["estimate"]["deleteMany"]({ where: { orgId } });
          await tx["changeOrder"]["deleteMany"]({ where: { orgId } });
          await tx["expense"]["deleteMany"]({ where: { orgId } });
          await tx["project"]["deleteMany"]({ where: { orgId } });
          await tx["subcontractor"]["deleteMany"]({ where: { orgId } });
          await tx["customer"]["deleteMany"]({ where: { orgId } });
          await tx["user"]["updateMany"]({
            where: { organizationId: orgId, id: { not: userId } },
            data: { organizationId: null },
          });
          await tx["organization"]["delete"]({ where: { id: orgId }, select: { id: true } });
        });
      } else {
        throw err;
      }
    }

    await revalidateOrg();
    return { count: 1 };
  });
}
