import { Link, redirect } from "@/i18n/navigation";
import Image from "next/image";
import { requireUser, isMissingColumnError, getActivePlan } from "@/lib/org";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import {
  markInvoicePaid,
  deleteInvoice,
  sendReminder,
  getInvoiceReminderSuppression,
  setInvoiceReminderSuppression,
  clearInvoiceReminderSuppression,
  getReminders,
} from "@/lib/actions/invoices";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Printer,
  Check,
  Trash2,
  Mail,
  Bell,
  BellOff,
  Calendar,
  Download,
  FileText,
} from "lucide-react";
import { InvoiceStatusManager } from "@/components/invoice-status-manager";
import { PaymentHistory } from "@/components/payment-history";
import { AuditLog } from "@/components/audit-log";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";
import { getTypeLabel, getTypeBadgeClass } from "@/lib/invoice-types";

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string; locale: string };
}) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const plan = await getActivePlan(user);
  const remindersEnabled = hasFeature(plan, "automaticReminders");
  const t = await getTranslations("invoices");

  let invoice;
  try {
    invoice = await db["invoice"]["findFirst"]({
      where: { id: params["id"], orgId: user["organizationId"] },
      include: {
        customer: true,
        project: true,
        items: { orderBy: { sortOrder: "asc" } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });
  } catch (err) {
    if (isMissingColumnError(err)) {
      invoice = await db["invoice"]["findFirst"]({
        where: { id: params["id"], orgId: user["organizationId"] },
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          issueDate: true,
          dueDate: true,
          currency: true,
          subtotal: true,
          taxRate: true,
          taxAmount: true,
          discount: true,
          retainageRate: true,
          retainageAmount: true,
          total: true,
          amountPaid: true,
          notes: true,
          stripeInvoiceId: true,
          recurringConfigId: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
          customerId: true,
          projectId: true,
          customer: true,
          project: true,
          items: { orderBy: { sortOrder: "asc" } },
        },
      }) as any;
    } else {
      logServerError("InvoiceDetailPage", err);
      throw err;
    }
  }
  if (!invoice) {
    redirect({ href: "/dashboard/invoices", locale: params["locale"] });
    // redirect() throws in the framework, but TypeScript doesn't know that for i18n redirect
    throw new Error("Unreachable: redirect should have exited");
  }
  if (!invoice["customer"]) {
    logServerError("InvoiceDetailPage", new Error(`Invoice ${invoice["id"]} has no customer relation`));
  }

  const statusVariant: Record<string, any> = {
    DRAFT: "secondary",
    SENT: "default",
    PAID: "success",
    UNPAID: "outline",
    OVERDUE: "destructive",
    VOID: "outline",
  };

  const remainingBalance = invoice["total"] - invoice["amountPaid"];

  const reminders = await getReminders({ invoiceId: params["id"] })["catch"](() => []);
  const suppression = await getInvoiceReminderSuppression(params["id"])["catch"](() => null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/invoices">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("back")}
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/dashboard/invoices/${invoice["id"]}/print`} target="_blank">
              <Printer className="mr-2 h-4 w-4" /> {t("exportPdf")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/documents/invoices/${invoice["id"]}/pdf`} target="_blank" download>
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </a>
          </Button>
          {invoice["status"] !== "PAID" && (
            <form
              action={async () => {
                "use server";
                await markInvoicePaid(invoice["id"]);
              }}
            >
              <Button type="submit" size="sm">
                <Check className="mr-2 h-4 w-4" /> {t("markPaid")}
              </Button>
            </form>
          )}
          <form
            action={async () => {
              "use server";
              await deleteInvoice(invoice["id"]);
            }}
          >
            <Button type="submit" size="sm" variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" /> {t("delete")}
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-start justify-between border-b pb-4">
                <div className="flex items-start gap-4">
                  {invoice["logoUrl"] && (
                    <Image src={invoice["logoUrl"]} alt={t("logoAlt")} width={48} height={48} className="h-12 w-auto object-contain" />
                  )}
                  <div>
                    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      {t("invoiceLabel")}
                    </span>
                    <h1 className="text-2xl font-bold mt-1">{invoice["number"]}</h1>
                    <p className="text-sm text-muted-foreground">
                      {t("issued", { date: formatDate(invoice["issueDate"]) })} &middot; {t("dueDate", { date: formatDate(invoice["dueDate"]) })}
                    </p>
                  </div>
                </div>
                <Badge variant={statusVariant[invoice["status"]] ?? "secondary"}>
                  {invoice["status"]}
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div>
                  <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">{t("billTo")}</p>
                  {invoice["billToAddress"] ? (
                    <div className="whitespace-pre-line">{invoice["billToAddress"]}</div>
                  ) : (
                    <>
                      <p className="font-medium">{invoice["customer"]?.["name"] ?? "Unknown"}</p>
                      {invoice["customer"]?.["company"] && <p>{invoice["customer"]["company"]}</p>}
                      {invoice["customer"]?.["email"] && <p>{invoice["customer"]["email"]}</p>}
                      {invoice["customer"]?.["address"] && <p>{invoice["customer"]["address"]}</p>}
                    </>
                  )}
                  {invoice["shipToAddress"] && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">{t("shipTo")}</p>
                      <div className="whitespace-pre-line">{invoice["shipToAddress"]}</div>
                    </div>
                  )}
                </div>
                <div>
                  {invoice["project"] && (
                    <div className="mb-4">
                      <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">{t("project")}</p>
                      <p>{invoice["project"]["name"]}</p>
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">{t("type")}</p>
                    <Badge variant="outline" className={getTypeBadgeClass(invoice["type"])}>
                      {getTypeLabel(invoice["type"], t)}
                    </Badge>
                  </div>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 w-8">#</th>
                    <th className="py-2">{t("description")}</th>
                    <th className="py-2 text-right">{t("quantity")}</th>
                    <th className="py-2 text-right">{t("unitPrice")}</th>
                    <th className="py-2 text-right">{t("amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice["items"]["map"]((it: any, idx: any) => (
                    <tr key={it["id"]} className="border-b">
                      <td className="py-2 text-gray-400">{idx + 1}</td>
                      <td className="py-2">{it["description"]}</td>
                      <td className="py-2 text-right">{it["quantity"]}</td>
                      <td className="py-2 text-right">
                        {formatCurrency(it["unitPrice"], invoice["currency"])}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {formatCurrency(it["amount"], invoice["currency"])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-72 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("subtotal")}</span>
                    <span>{formatCurrency(invoice["subtotal"], invoice["currency"])}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("tax")}</span>
                    <span>{formatCurrency(invoice["taxAmount"], invoice["currency"])}</span>
                  </div>
                  {invoice["discount"] > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("discount")}</span>
                      <span>-{formatCurrency(invoice["discount"], invoice["currency"])}</span>
                    </div>
                  )}
                  {invoice["retainageAmount"] > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("retainage")}</span>
                      <span>{formatCurrency(invoice["retainageAmount"], invoice["currency"])}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 text-base font-bold">
                    <span>{t("total")}</span>
                    <span>{formatCurrency(invoice["total"], invoice["currency"])}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("paid")}</span>
                    <span>{formatCurrency(invoice["amountPaid"], invoice["currency"])}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 text-base font-bold text-orange-600">
                    <span>{t("balanceDue")}</span>
                    <span>{formatCurrency(remainingBalance, invoice["currency"])}</span>
                  </div>
                </div>
              </div>

              {invoice["notes"] && (
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">{t("notes")}</p>
                  <p className="whitespace-pre-line">{invoice["notes"]}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <InvoiceStatusManager
            invoiceId={invoice["id"]}
            currentStatus={invoice["status"]}
          />
           {invoice["status"] !== "PAID" && remindersEnabled && (
             <form
               action={async () => {
                 "use server";
                 try {
                   await sendReminder(invoice["id"]);
                 } catch (err: any) {
                   logServerError("sendReminderFormAction", err);
                 }
               }}
             >
               <Button type="submit" variant="outline" className="w-full">
                 <Mail className="mr-2 h-4 w-4" /> {t("sendReminder")}
               </Button>
             </form>
           )}

          {reminders["length"] > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Reminders sent</CardTitle>
                <CardDescription>
                  {reminders["length"]} reminder(s) have been sent for this invoice.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {reminders["slice"](0, 5)["map"]((r: any) => {
                  const statusVariant: Record<string, any> = {
                    SENT: "secondary",
                    DELIVERED: "success",
                    QUEUED: "outline",
                    FAILED: "destructive",
                    BOUNCED: "destructive",
                    SKIPPED: "secondary",
                    PENDING: "secondary",
                  };
                  return (
                    <div key={r["id"]} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          {r["stage"]?.["name"] || r["type"]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(r["sentAt"] || r["scheduledAt"])}
                        </p>
                      </div>
                      <Badge variant={statusVariant[r["status"]] ?? "secondary"}>
                        {r["status"]}
                      </Badge>
                    </div>
                  );
                })}
                {reminders["length"] > 5 && (
                  <p className="text-xs text-muted-foreground">
                    +{reminders["length"] - 5} more
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {invoice["status"] !== "PAID" && invoice["customer"]?.["email"] && remindersEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Automated reminders</CardTitle>
            <CardDescription>
              Configure automated payment reminders for this invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {suppression?.["suppressedAll"] && (
              <div className="rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                All automated reminders are suppressed for this invoice.
                {suppression["snoozedUntil"] &&
                  ` Snoozed until ${formatDate(suppression["snoozedUntil"])}.`}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Suppress all automated reminders</p>
                  <p className="text-sm text-muted-foreground">
                    No reminders will be sent for this invoice.
                  </p>
                </div>
              </div>
              <form
                action={async () => {
                  "use server";
                  if (suppression?.["suppressedAll"]) {
                    await clearInvoiceReminderSuppression(invoice["id"]);
                  } else {
                    await setInvoiceReminderSuppression(invoice["id"], { suppressedAll: true });
                  }
                }}
              >
                <Button type="submit" variant={suppression?.["suppressedAll"] ? "outline" : "destructive"} size="sm">
                  {suppression?.["suppressedAll"] ? "Restore reminders" : "Suppress all"}
                </Button>
              </form>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Snooze reminders</p>
                  <p className="text-sm text-muted-foreground">
                    Skip reminders until a specific date.
                  </p>
                </div>
              </div>
              <form
                action={async () => {
                  "use server";
                  const snoozeDate = new Date();
                  snoozeDate["setDate"](snoozeDate["getDate"]() + 14);
                  await setInvoiceReminderSuppression(invoice["id"], {
                    suppressedAll: false,
                    snoozedUntil: snoozeDate["toISOString"](),
                  });
                }}
              >
                <Button type="submit" variant="outline" size="sm">
                  Snooze 14 days
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}


      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentHistory invoiceId={invoice["id"]} currency={invoice["currency"]} />
        <AuditLog invoiceId={invoice["id"]} />
      </div>
    </div>
  );
}
