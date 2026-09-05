import { requireUser, getCurrentOrg, getActivePlan } from "@/lib/org";
import { hasFeature } from "@/lib/plans";
import { db } from "@/lib/db";
import { logServerError } from "@/lib/errors";
import { InvoiceForm } from "@/components/invoice-form";
import { getTranslations } from "next-intl/server";
import { computeProjectFinancials } from "@/lib/project-financials";

export default async function NewInvoicePage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { projectId?: string };
}) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];
  const plan = await getActivePlan(user);
  const t = await getTranslations("invoices");

  const preselectedProjectId =
    typeof searchParams?.["projectId"] === "string" ? searchParams["projectId"] : null;

  let customers;
  let projects;
  let preselectedProject:
    | {
        id: string;
        name: string;
        customerId: string | null;
        contractValue: number;
        estimatedCost: number;
        taxRate: number;
        paymentTerms: string;
      }
    | null = null;
  let projectFinancials:
    | {
        currentContractValue: number;
        totalInvoiced: number;
        remainingBillable: number;
        outstandingBalance: number;
        currency: string;
      }
    | null = null;

  try {
    [customers, projects] = await Promise["all"]([
      db["customer"]["findMany"]({
        where: { orgId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      db["project"]["findMany"]({
        where: { orgId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          customerId: true,
          contractValue: true,
          estimatedCost: true,
          taxRate: true,
          paymentTerms: true,
        },
      }),
    ]);

    if (preselectedProjectId) {
      const p = projects.find((p) => p.id === preselectedProjectId);
      if (p) {
        preselectedProject = p;

        // Compute the current contract value and remaining billable so the
        // form can warn the contractor if they try to overbill the project.
        let invoices: { total: number; amountPaid: number; status: string; currency?: string }[] = [];
        try {
          invoices = await db["invoice"]["findMany"]({
            where: { orgId, projectId: preselectedProjectId },
            select: { total: true, amountPaid: true, status: true, currency: true },
          });
        } catch (err) {
          logServerError("NewInvoicePage: invoice lookup", err);
        }

        let changeOrders: { changeAmount: number; status: string }[] = [];
        try {
          changeOrders = await db["changeOrder"]["findMany"]({
            where: { orgId, projectId: preselectedProjectId },
            select: { changeAmount: true, status: true },
          });
        } catch (err) {
          logServerError("NewInvoicePage: change order lookup", err);
        }

        const f = computeProjectFinancials({
          originalContractValue: Number(p.contractValue ?? 0),
          estimatedCost: Number(p.estimatedCost ?? 0),
          depositPaid: 0,
          currency: "USD",
          invoices: invoices.map((i) => ({
            total: Number(i.total ?? 0),
            amountPaid: Number(i.amountPaid ?? 0),
            status: i.status ?? "DRAFT",
            currency: i.currency,
          })),
          payments: [],
          expenses: [],
          changeOrders: changeOrders.map((co) => ({
            changeAmount: Number(co.changeAmount ?? 0),
            status: co.status ?? "DRAFT",
          })),
        });
        projectFinancials = {
          currentContractValue: f.currentContractValue,
          totalInvoiced: f.totalInvoiced,
          remainingBillable: f.remainingBillable,
          outstandingBalance: f.outstandingBalance,
          currency: f.currency,
        };
      }
    }
  } catch (err) {
    logServerError("NewInvoicePage", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("newInvoice")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("currentPlan", { plan })}
        </p>
      </div>
        <InvoiceForm
          customers={customers}
          projects={projects}
          canRetainage={hasFeature(plan, "retainage")}
          canProgress={hasFeature(plan, "progressInvoices")}
          canRecurring={hasFeature(plan, "recurring")}
          canCustomizeInvoiceNumber={true}
          canProjectManagement={hasFeature(plan, "projectManagement")}
          hasSavedAddresses={hasFeature(plan, "savedAddresses")}
          canUseCatalog={hasFeature(plan, "catalogItems")}
          canUseTimeTracking={hasFeature(plan, "timeTracking")}
          preselectedProject={preselectedProject}
          projectFinancials={projectFinancials}
        />
    </div>
  );
}