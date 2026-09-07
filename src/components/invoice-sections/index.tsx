"use client";

import * as React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getTypeLabel } from "@/lib/invoice-types";
import type { InvoiceSectionConfig } from "@/lib/invoice-template-config";
import { Badge } from "@/components/ui/badge";

interface SectionProps {
  section: InvoiceSectionConfig;
  invoice: any;
  org?: any;
  locale?: string;
  onFieldChange?: (fieldId: string, value: any) => void;
  isEditor?: boolean;
}

export const SectionComponents: Record<string, React.ComponentType<SectionProps>> = {
  business_info: BusinessInfoSection,
  customer_info: CustomerInfoSection,
  project_info: ProjectInfoSection,
  invoice_details: InvoiceDetailsSection,
  line_items: LineItemsSection,
  labor_table: LaborTableSection,
  materials_table: MaterialsTableSection,
  equipment_table: EquipmentTableSection,
  change_orders: ChangeOrdersSection,
  schedule_of_values: ScheduleOfValuesSection,
  retainage: RetainageSection,
  previous_payments: PreviousPaymentsSection,
  discounts: DiscountsSection,
  taxes: TaxesSection,
  payment_terms: PaymentTermsSection,
  payment_summary: PaymentSummarySection,
  notes: NotesSection,
  terms: TermsSection,
  signature: SignatureSection,
  photos: PhotosSection,
  attachments: AttachmentsSection,
  qr_code: QRCodeSection,
  payment_button: PaymentButtonSection,
  milestone_info: MilestoneInfoSection,
  custom_field: CustomFieldSection,
};

function getVisibleFields(section: InvoiceSectionConfig, invoice: any): InvoiceSectionConfig["fields"] {
  return (section["fields"] ?? []).filter((f) => {
    if (!f["visible"]) return false;
    if (f["conditional"]) {
      const val = invoice[f["conditional"]["fieldId"]];
      const condVal = f["conditional"]["value"];
      switch (f["conditional"]["operator"]) {
        case "equals":
          return val === condVal;
        case "not_equals":
          return val !== condVal;
        case "exists":
          return val != null && val !== "";
        case "greater_than":
          return Number(val) > Number(condVal);
        case "less_than":
          return Number(val) < Number(condVal);
        default:
          return true;
      }
    }
    return true;
  });
}

export function RenderSection({ section, invoice, org, locale, onFieldChange, isEditor = false }: SectionProps) {
  if (!section["visible"]) return null;

  const Component = SectionComponents[section["type"]];
  if (!Component) return null;

  return (
    <Component
      section={section}
      invoice={invoice}
      org={org}
      locale={locale}
      onFieldChange={onFieldChange}
      isEditor={isEditor}
    />
  );
}

export function RenderSections({
  sections,
  invoice,
  org,
  locale = "en",
  onFieldChange,
  isEditor = false,
}: {
  sections: InvoiceSectionConfig[];
  invoice: any;
  org?: any;
  locale?: string;
  onFieldChange?: (fieldId: string, value: any) => void;
  isEditor?: boolean;
}) {
  const sorted = [...sections].sort((a, b) => (a["position"] ?? 0) - (b["position"] ?? 0));
  return sorted.map((section) => {
    if (!section["visible"]) return null;
    const Component = SectionComponents[section["type"]];
    if (!Component) return null;
    return (
      <div key={section["id"]} className={`section-${section["type"]} mb-4`}>
        {!isEditor && (section["label"] || section["type"]) && (
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            {section["label"] || section["type"]}
          </h3>
        )}
        <Component
          section={section}
          invoice={invoice}
          org={org}
          locale={locale}
          onFieldChange={onFieldChange}
          isEditor={isEditor}
        />
      </div>
    );
  });
}

function BusinessInfoSection({ section, invoice, org, isEditor }: SectionProps) {
  const visibleFields = getVisibleFields(section, invoice);
  const brandColor = org?.["brandColor"] || "#3b82f6";

  return (
    <div className="flex items-start justify-between pb-4">
      <div className="flex items-start gap-4">
        {invoice["logoUrl"] && (
          <img src={invoice["logoUrl"]} alt="Logo" className="h-16 w-auto object-contain" />
        )}
        <div>
          <p className="text-lg font-semibold" style={{ color: brandColor }}>
            {invoice["orgName"] || org?.["name"] || "Your Company"}
          </p>
          {invoice["orgTagline"] && <p className="text-xs text-gray-500">{invoice["orgTagline"]}</p>}
          {invoice["orgAddress"] && <p className="text-xs text-gray-500 whitespace-pre-line">{invoice["orgAddress"]}</p>}
        </div>
      </div>
      <div className="text-right">
        {invoice["type"] && (
          <Badge style={{ backgroundColor: org?.["accentColor"] || brandColor, color: "white" }}>
            {getTypeLabel(invoice["type"], (key: string) => key)}
          </Badge>
        )}
        <h2 className="text-2xl font-bold mt-2">{invoice["number"] || "INV-001"}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {invoice["issueDate"] && `Issued ${formatDate(invoice["issueDate"])}`}
        </p>
        <p className="text-sm text-gray-500">
          {invoice["dueDate"] && `Due ${formatDate(invoice["dueDate"])}`}
        </p>
      </div>
    </div>
  );
}

function CustomerInfoSection({ section, invoice }: SectionProps) {
  const visibleFields = getVisibleFields(section, invoice);
  return (
    <div className="text-sm">
      <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">Bill To</p>
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
        <div className="mt-4 pt-4 border-t">
          <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">Ship To</p>
          <div className="whitespace-pre-line">{invoice["shipToAddress"]}</div>
        </div>
      )}
    </div>
  );
}

function ProjectInfoSection({ section, invoice }: SectionProps) {
  const visibleFields = getVisibleFields(section, invoice);
  if (!invoice["project"]) return null;
  return (
    <div className="text-sm">
      <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">Project</p>
      <p>{invoice["project"]["name"]}</p>
      {invoice["project"]["number"] && <p className="text-xs text-gray-500">{invoice["project"]["number"]}</p>}
      {invoice["project"]["address"] && <p className="text-xs text-gray-500 whitespace-pre-line">{invoice["project"]["address"]}</p>}
    </div>
  );
}

function InvoiceDetailsSection({ section, invoice }: SectionProps) {
  const visibleFields = getVisibleFields(section, invoice);
  return (
    <div className="grid gap-2 text-sm">
      <div>
        <span className="font-semibold text-xs uppercase tracking-wider text-gray-400">Invoice #:</span> {invoice["number"]}
      </div>
      <div>
        <span className="font-semibold text-xs uppercase tracking-wider text-gray-400">Issue Date:</span> {invoice["issueDate"] ? formatDate(invoice["issueDate"]) : ""}
      </div>
      <div>
        <span className="font-semibold text-xs uppercase tracking-wider text-gray-400">Due Date:</span> {invoice["dueDate"] ? formatDate(invoice["dueDate"]) : ""}
      </div>
      {invoice["type"] && (
        <div>
          <span className="font-semibold text-xs uppercase tracking-wider text-gray-400">Type:</span>{" "}
          <Badge variant="outline">{getTypeLabel(invoice["type"], (key: string) => key)}</Badge>
        </div>
      )}
      {invoice["status"] && (
        <div>
          <span className="font-semibold text-xs uppercase tracking-wider text-gray-400">Status:</span>{" "}
          <Badge variant="outline">{invoice["status"]}</Badge>
        </div>
      )}
    </div>
  );
}

function LineItemsSection({ section, invoice }: SectionProps) {
  const items = invoice["items"] ?? [];
  if (items["length"] === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 w-8">#</th>
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Unit Price</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items["map"]((it: any, idx: number) => (
            <tr key={it["id"] || idx} className="border-b">
              <td className="py-2 text-gray-400">{idx + 1}</td>
              <td className="py-2">{it["description"]}</td>
              <td className="py-2 text-right">{it["quantity"]}</td>
              <td className="py-2 text-right">{formatCurrency(it["unitPrice"], invoice["currency"])}</td>
              <td className="py-2 text-right font-medium">
                {formatCurrency(it["amount"] ?? it["quantity"] * it["unitPrice"], invoice["currency"])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LaborTableSection({ section, invoice }: SectionProps) {
  const laborItems = invoice["laborItems"] ?? [];
  if (laborItems["length"] === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2">Labor</th>
            <th className="py-2 text-right">Hours</th>
            <th className="py-2 text-right">Rate</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {laborItems["map"]((it: any, idx: number) => (
            <tr key={it["id"] || idx} className="border-b">
              <td className="py-2">{it["description"]}</td>
              <td className="py-2 text-right">{it["quantity"]}</td>
              <td className="py-2 text-right">{formatCurrency(it["unitPrice"], invoice["currency"])}</td>
              <td className="py-2 text-right font-medium">
                {formatCurrency(it["amount"] ?? it["quantity"] * it["unitPrice"], invoice["currency"])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MaterialsTableSection({ section, invoice }: SectionProps) {
  const materialItems = invoice["materialItems"] ?? [];
  if (materialItems["length"] === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2">Material</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Unit Price</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {materialItems["map"]((it: any, idx: number) => (
            <tr key={it["id"] || idx} className="border-b">
              <td className="py-2">{it["description"]}</td>
              <td className="py-2 text-right">{it["quantity"]}</td>
              <td className="py-2 text-right">{formatCurrency(it["unitPrice"], invoice["currency"])}</td>
              <td className="py-2 text-right font-medium">
                {formatCurrency(it["amount"] ?? it["quantity"] * it["unitPrice"], invoice["currency"])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EquipmentTableSection({ section, invoice }: SectionProps) {
  const equipItems = invoice["equipmentItems"] ?? [];
  if (equipItems["length"] === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2">Equipment</th>
            <th className="py-2 text-right">Days</th>
            <th className="py-2 text-right">Rate/Day</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {equipItems["map"]((it: any, idx: number) => (
            <tr key={it["id"] || idx} className="border-b">
              <td className="py-2">{it["description"]}</td>
              <td className="py-2 text-right">{it["quantity"]}</td>
              <td className="py-2 text-right">{formatCurrency(it["unitPrice"], invoice["currency"])}</td>
              <td className="py-2 text-right font-medium">
                {formatCurrency(it["amount"] ?? it["quantity"] * it["unitPrice"], invoice["currency"])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangeOrdersSection({ section, invoice }: SectionProps) {
  const changeOrders = invoice["changeOrders"] ?? [];
  if (changeOrders["length"] === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2">CO #</th>
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Amount</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {changeOrders["map"]((co: any) => (
            <tr key={co["id"]} className="border-b">
              <td className="py-2">{co["number"] || co["id"]}</td>
              <td className="py-2">{co["title"] || co["description"]}</td>
              <td className="py-2 text-right">{formatCurrency(co["amount"] || co["changeAmount"], invoice["currency"])}</td>
              <td className="py-2"><Badge variant="outline">{co["status"]}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduleOfValuesSection({ section, invoice }: SectionProps) {
  const sovLines = invoice["scheduleOfValues"] ?? [];
  if (sovLines["length"] === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2">Item</th>
            <th className="py-2 text-right">Amount</th>
            <th className="py-2 text-right">% Complete</th>
            <th className="py-2 text-right">Billed</th>
          </tr>
        </thead>
        <tbody>
          {sovLines["map"]((it: any, idx: number) => (
            <tr key={it["id"] || idx} className="border-b">
              <td className="py-2">{it["description"] || it["lineItem"]}</td>
              <td className="py-2 text-right">{formatCurrency(it["amount"], invoice["currency"])}</td>
              <td className="py-2 text-right">{it["completedPercent"] ?? 0}%</td>
              <td className="py-2 text-right">{it["billed"] ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RetainageSection({ section, invoice }: SectionProps) {
  const retainageRate = invoice["retainageRate"] ?? 0;
  const retainageAmount = invoice["retainageAmount"] ?? 0;
  if (retainageRate === 0 && retainageAmount === 0) return null;
  return (
    <div className="text-sm">
      <div className="flex justify-between py-1">
        <span>Retainage Rate</span>
        <span>{retainageRate}%</span>
      </div>
      <div className="flex justify-between py-1 font-semibold">
        <span>Retained Amount</span>
        <span>-{formatCurrency(retainageAmount, invoice["currency"])}</span>
      </div>
    </div>
  );
}

function PreviousPaymentsSection({ section, invoice }: SectionProps) {
  const payments = invoice["payments"] ?? [];
  if (payments["length"] === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2">Date</th>
            <th className="py-2">Amount</th>
            <th className="py-2">Method</th>
          </tr>
        </thead>
        <tbody>
          {payments["map"]((p: any) => (
            <tr key={p["id"]} className="border-b">
              <td className="py-2">{p["date"] ? formatDate(p["date"]) : ""}</td>
              <td className="py-2">{formatCurrency(p["amount"], invoice["currency"])}</td>
              <td className="py-2">{p["method"] || "Other"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiscountsSection({ section, invoice }: SectionProps) {
  if ((invoice["discount"] ?? 0) === 0) return null;
  return (
    <div className="flex justify-between py-1 text-sm">
      <span>Discount</span>
      <span>-{formatCurrency(invoice["discount"], invoice["currency"])}</span>
    </div>
  );
}

function TaxesSection({ section, invoice }: SectionProps) {
  if ((invoice["taxAmount"] ?? 0) === 0) return null;
  return (
    <div className="flex justify-between py-1 text-sm">
      <span>Tax</span>
      <span>{formatCurrency(invoice["taxAmount"], invoice["currency"])}</span>
    </div>
  );
}

function PaymentTermsSection({ section, invoice }: SectionProps) {
  if (!invoice["paymentTerms"] && !invoice["termsAndConditions"]) return null;
  return (
    <div className="text-sm">
      {invoice["paymentTerms"] && (
        <p>{invoice["paymentTerms"]}</p>
      )}
      {invoice["termsAndConditions"] && (
        <p className="mt-2 whitespace-pre-line">{invoice["termsAndConditions"]}</p>
      )}
    </div>
  );
}

function NotesSection({ section, invoice }: SectionProps) {
  if (!invoice["notes"]) return null;
  return (
    <div className="text-sm text-muted-foreground">
      <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">Notes</p>
      <p className="whitespace-pre-line">{invoice["notes"]}</p>
    </div>
  );
}

function TermsSection({ section, invoice }: SectionProps) {
  if (!invoice["termsAndConditions"]) return null;
  return (
    <div className="text-sm text-muted-foreground">
      <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">Terms & Conditions</p>
      <p className="whitespace-pre-line">{invoice["termsAndConditions"]}</p>
    </div>
  );
}

function SignatureSection({ section, invoice }: SectionProps) {
  if (!invoice["signature"]) return null;
  return (
    <div className="mt-8">
      <img src={invoice["signature"]} alt="Signature" className="h-16 w-auto" />
      {invoice["signedBy"] && <p className="text-xs mt-1">Signed by: {invoice["signedBy"]}</p>}
    </div>
  );
}

function PhotosSection({ section, invoice }: SectionProps) {
  const photos = invoice["photos"] ?? [];
  if (photos["length"] === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {photos["map"]((p: any, idx: number) => (
        <img key={p["id"] || idx} src={p["url"]} alt="Photo" className="h-20 w-20 object-cover rounded" />
      ))}
    </div>
  );
}

function AttachmentsSection({ section, invoice }: SectionProps) {
  const attachments = invoice["attachments"] ?? [];
  if (attachments["length"] === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {attachments["map"]((a: any, idx: number) => (
        <a key={a["id"] || idx} href={a["url"]} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600">
          {a["name"] || "Attachment"}
        </a>
      ))}
    </div>
  );
}

function QRCodeSection({ section, invoice }: SectionProps) {
  if (!invoice["qrCodeData"]) return null;
  return (
    <div className="mt-4">
      <img src={`https://api.qrserver.com/v1/generator?size=100x100&data=${encodeURIComponent(invoice["qrCodeData"])}`} alt="QR Code" className="h-20 w-20" />
    </div>
  );
}

function PaymentButtonSection({ section, invoice }: SectionProps) {
  if (!invoice["paymentUrl"]) return null;
  return (
    <div className="mt-4">
      <a
        href={invoice["paymentUrl"]}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-4 py-2 bg-blue-600 text-white rounded font-medium"
      >
        {invoice["buttonLabel"] || "Pay Now"}
      </a>
    </div>
  );
}

function PaymentSummarySection({ section, invoice }: SectionProps) {
  const currency = invoice["currency"] || "USD";
  const subtotal = invoice["subtotal"] ?? 0;
  const discount = invoice["discount"] ?? 0;
  const taxAmount = invoice["taxAmount"] ?? 0;
  const retainageAmount = invoice["retainageAmount"] ?? 0;
  const total = invoice["total"] ?? 0;
  const amountPaid = invoice["amountPaid"] ?? 0;
  const balanceDue = invoice["balanceDue"] ?? (total - amountPaid);
  const hasPayments = amountPaid > 0;

  return (
    <div className="mt-4 border-t pt-4 space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-600">Subtotal</span>
        <span>{formatCurrency(subtotal, currency)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-600">Discount</span>
          <span>-{formatCurrency(discount, currency)}</span>
        </div>
      )}
      {taxAmount > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-600">Tax</span>
          <span>{formatCurrency(taxAmount, currency)}</span>
        </div>
      )}
      {retainageAmount > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-600">Retainage</span>
          <span>-{formatCurrency(retainageAmount, currency)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-lg pt-2 border-t">
        <span>Total</span>
        <span>{formatCurrency(total, currency)}</span>
      </div>
      {hasPayments && (
        <>
          <div className="flex justify-between">
            <span className="text-gray-600">Amount Paid</span>
            <span className="text-green-600">{formatCurrency(amountPaid, currency)}</span>
          </div>
          <div className="flex justify-between font-semibold pt-2 border-t">
            <span>Balance Due</span>
            <span className={balanceDue > 0 ? "text-red-600" : "text-green-600"}>
              {formatCurrency(balanceDue, currency)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function MilestoneInfoSection({ section, invoice }: SectionProps) {
  if (!invoice["milestoneTitle"]) return null;
  return (
    <div className="text-sm">
      <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">Milestone</p>
      <p className="font-medium">{invoice["milestoneTitle"]}</p>
      {invoice["milestoneDescription"] && (
        <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">
          {invoice["milestoneDescription"]}
        </p>
      )}
      <div className="mt-2 space-y-1">
        {invoice["milestoneDate"] && (
          <p className="text-xs"><span className="font-medium">Date:</span> {formatDate(invoice["milestoneDate"])}</p>
        )}
        {invoice["milestoneAmount"] && (
          <p className="text-xs"><span className="font-medium">Amount:</span> {formatCurrency(invoice["milestoneAmount"], invoice["currency"])}</p>
        )}
        {invoice["milestoneCompleted"] && (
          <span className="inline-block px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
            Completed
          </span>
        )}
      </div>
    </div>
  );
}

function CustomFieldSection({ section, invoice }: SectionProps) {
  const fields = section["fields"] ?? [];
  if (fields.length === 0) return null;
  return (
    <div className="text-sm space-y-1">
      {fields.map((f) => {
        const value = invoice[f["name"]] ?? invoice[f["id"]] ?? "";
        if (value === "" || value == null) return null;
        return (
          <div key={f["id"]} className="flex justify-between gap-4">
            <span className="text-gray-500">{f["label"]}</span>
            <span className="font-medium text-right">{String(value)}</span>
          </div>
        );
      })}
    </div>
  );
}


