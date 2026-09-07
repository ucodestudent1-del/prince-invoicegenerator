import { requireUser, getCurrentOrg } from "@/lib/org";
import { getTranslations } from "next-intl/server";
import { getTemplates } from "@/lib/actions/templates";
import { getDefaultTemplate } from "@/lib/invoice-template-config";
import { TemplateManager } from "@/components/template-manager";
import type { InvoiceType } from "@prisma/client";

const INVOICE_TYPES: InvoiceType[] = [
  "STANDARD",
  "FIXED_PRICE",
  "TIME_AND_MATERIALS",
  "PROGRESS",
  "MILESTONE",
  "CHANGE_ORDER",
  "DEPOSIT",
  "RETAINAGE",
  "FINAL",
  "RECURRING",
  "EXPENSE",
  "CUSTOM",
];

export default async function InvoiceTemplatesPage() {
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const org = await getCurrentOrg();
  const t = await getTranslations("invoiceTemplates");

  const dbTemplates = await getTemplates(user["organizationId"]);

  const allTemplates = [
    ...INVOICE_TYPES.map((type) => getDefaultTemplate(type)),
    ...dbTemplates,
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <TemplateManager
        templates={allTemplates}
        org={org}
        locale={t("locale") ?? "en"}
      />
    </div>
  );
}
