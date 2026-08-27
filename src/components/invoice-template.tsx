import { formatCurrency, formatDate, quoteFontFamily } from "@/lib/utils";
import { getTypeLabel, getTypeBadgeClass } from "@/lib/invoice-types";

export interface InvoiceTemplateProps {
  invoice: any;
  org?: any;
  showActions?: boolean;
  paperSize?: "A4" | "Letter" | "Legal";
  locale?: string;
}

const PAPER_SIZES = {
  A4: "210mm",
  Letter: "215.9mm",
  Legal: "215.9mm",
} as const;

export function InvoiceTemplate({ invoice, org, paperSize = "A4", locale = "en" }: InvoiceTemplateProps) {
  const t = getTranslations(locale);
  const _t = (key: string) => translate(t, key);
  const paperWidth = PAPER_SIZES[paperSize];
  const templateClass = `template-${org?.["template"]?.["toLowerCase"]?.() ?? "standard"}`;
  const layoutClass = `layout-${org?.["layout"] ?? "default"}`;
  const items: any[] = invoice["items"] ?? [];

  return (
    <div
      className={`invoice-page ${templateClass} ${layoutClass}`}
      style={{
        width: paperWidth,
        minHeight: "297mm",
        padding: "15mm 12mm",
        margin: "0 auto",
        backgroundColor: "white",
        color: "black",
        fontFamily: org?.["fontFamily"] ? quoteFontFamily(org["fontFamily"]) : "'Inter', system-ui, sans-serif",
        fontSize: "10pt",
        lineHeight: 1.4,
        position: "relative",
      }}
    >
      {/* Watermark for free tier */}
      {!org?.["canPdfExport"] && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          <span
            style={{
              fontSize: "3rem",
              fontWeight: "bold",
              color: "#e5e7eb",
              opacity: 0.4,
              transform: "rotate(-12deg)",
              userSelect: "none",
            }}
          >
            {t["poweredBy"]}
          </span>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "2rem",
          paddingBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          {invoice["logoUrl"] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={invoice["logoUrl"]} alt={t["brandName"]} style={{ height: "4rem", width: "auto", objectFit: "contain" }} />
          )}
          <div>
            <p style={{ fontSize: "1.125rem", fontWeight: 600, color: org?.["brandColor"] || undefined }}>
              {t["brandName"]}
            </p>
            <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>{t["brandTagline"]}</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span
            style={{
              display: "inline-block",
              borderRadius: "9999px",
              padding: "0.25rem 0.75rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              backgroundColor: org?.["accentColor"] || "#3b82f6",
              color: "white",
            }}
          >
            {t["invoice"]}
          </span>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.5rem" }}>{invoice["number"]}</h2>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.25rem" }}>
            {t["issued"]} {formatDate(invoice["issueDate"])}
          </p>
          <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
            {t["due"]} {formatDate(invoice["dueDate"])}
          </p>
        </div>
      </div>

      {/* Bill To / Ship To / Project */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem", fontSize: "0.875rem" }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: "0.25rem" }}>
            {t["billTo"]}
          </p>
          {invoice["billToAddress"] ? (
            <div style={{ whiteSpace: "pre-line" }}>{invoice["billToAddress"]}</div>
          ) : (
            <>
              <p style={{ fontWeight: 500 }}>{invoice["customer"]?.["name"] ?? "Unknown"}</p>
              {invoice["customer"]?.["company"] && <p>{invoice["customer"]["company"]}</p>}
              {invoice["customer"]?.["email"] && <p>{invoice["customer"]["email"]}</p>}
              {invoice["customer"]?.["address"] && <p>{invoice["customer"]["address"]}</p>}
            </>
          )}
          {invoice["shipToAddress"] && (
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: "0.25rem" }}>
                {t["shipTo"]}
              </p>
              <div style={{ whiteSpace: "pre-line" }}>{invoice["shipToAddress"]}</div>
            </div>
          )}
        </div>
        <div>
          {invoice["project"] && (
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: "0.25rem" }}>
                {t["project"]}
              </p>
              <p>{invoice["project"]["name"]}</p>
            </div>
          )}
          <div>
            <p style={{ fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: "0.25rem" }}>
              {t["type"]}
            </p>
            <span className={`${getTypeBadgeClass(invoice["type"])}`} style={{ display: "inline-block", borderRadius: "9999px", padding: "0.25rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {getTypeLabel(invoice["type"], _t)}
            </span>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <table style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #d1d5db", textAlign: "left" }}>
            <th style={{ padding: "0.5rem 0", width: "2rem" }}>#</th>
            <th style={{ padding: "0.5rem 0" }}>{t["description"]}</th>
            <th style={{ padding: "0.5rem 0", textAlign: "right" }}>{t["qty"]}</th>
            <th style={{ padding: "0.5rem 0", textAlign: "right" }}>{t["unitPrice"]}</th>
            <th style={{ padding: "0.5rem 0", textAlign: "right" }}>{t["amount"]}</th>
          </tr>
        </thead>
        <tbody>
          {items["map"]((it: any, idx: number) => (
            <tr key={it["id"]} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "0.5rem 0", color: "#9ca3af" }}>{idx + 1}</td>
              <td style={{ padding: "0.5rem 0" }}>{it["description"]}</td>
              <td style={{ padding: "0.5rem 0", textAlign: "right" }}>{it["quantity"]}</td>
              <td style={{ padding: "0.5rem 0", textAlign: "right" }}>
                {formatCurrency(it["unitPrice"], invoice["currency"])}
              </td>
              <td style={{ padding: "0.5rem 0", textAlign: "right", fontWeight: 500 }}>
                {formatCurrency(it["amount"], invoice["currency"])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: "18rem", fontSize: "0.875rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#6b7280" }}>{t["subtotal"]}</span>
            <span>{formatCurrency(invoice["subtotal"], invoice["currency"])}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#6b7280" }}>{t["tax"]}</span>
            <span>{formatCurrency(invoice["taxAmount"], invoice["currency"])}</span>
          </div>
          {invoice["discount"] > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280" }}>{t["discount"]}</span>
              <span>-{formatCurrency(invoice["discount"], invoice["currency"])}</span>
            </div>
          )}
          {invoice["retainageAmount"] > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280" }}>{t["retainage"]}</span>
              <span>{formatCurrency(invoice["retainageAmount"], invoice["currency"])}</span>
            </div>
          )}
          <div
            style={{
              borderTop: `2px solid ${org?.["accentColor"] || "#3b82f6"}`,
              paddingTop: "0.25rem",
              marginTop: "0.25rem",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "1rem",
              fontWeight: 700,
              color: org?.["accentColor"] || "#3b82f6",
            }}
          >
            <span>{t["total"]}</span>
            <span>{formatCurrency(invoice["total"], invoice["currency"])}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice["notes"] && (
        <div style={{ marginTop: "2rem", fontSize: "0.875rem" }}>
          <p style={{ fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: "0.25rem" }}>
            {t["notes"]}
          </p>
          <p style={{ color: "#4b5563", whiteSpace: "pre-line" }}>{invoice["notes"]}</p>
        </div>
      )}
    </div>
  );
}

function getTranslations(locale: string) {
  const translations: Record<string, Record<string, string>> = {
    en: {
      brandName: "Prince",
      brandTagline: "Construction Invoicing",
      invoice: "Invoice",
      issued: "Issued",
      due: "Due",
      billTo: "Bill To",
      shipTo: "Ship To",
      project: "Project",
      type: "Type",
      description: "Description",
      qty: "Qty",
      unitPrice: "Unit Price",
      amount: "Amount",
      subtotal: "Subtotal",
      tax: "Tax",
      discount: "Discount",
      retainage: "Retainage",
      total: "Total",
      notes: "Notes",
      poweredBy: "Powered by Prince",
      standard: "Standard",
      progress: "Progress (AIA-style)",
      recurring: "Recurring",
    },
  };
  return translations[locale] || translations["en"];
}

function translate(t: Record<string, string>, key: string): string {
  return t[key] || key;
}
