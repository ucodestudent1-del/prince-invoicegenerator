import { formatCurrency, formatDate, quoteFontFamily } from "@/lib/utils";
import { getTypeLabel, getTypeBadgeClass } from "@/lib/invoice-types";
import { PAPER_SIZES, type PaperSize } from "@/lib/pdf-constants";

export type EntityType = "invoices" | "change-orders" | "estimates";

export interface DocumentTemplateProps {
  entityType: EntityType;
  doc: any;
  org?: any;
  paperSize?: PaperSize;
  locale?: string;
}

const LABELS: Record<EntityType, Record<string, string>> = {
  invoices: {
    title: "Invoice",
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
  },
  estimates: {
    title: "Estimate",
    issued: "Issued",
    due: "Valid Until",
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
  },
  "change-orders": {
    title: "Change Order",
    issued: "Issued",
    due: "Amount",
    billTo: "Project",
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
  },
};

const ACCENT = "#3b82f6";

export function DocumentTemplate({
  entityType,
  doc,
  org,
  paperSize = "A4",
  locale: _locale = "en",
}: DocumentTemplateProps) {
  const t = LABELS[entityType] ?? LABELS.invoices;
  const paper = PAPER_SIZES[paperSize];
  const templateClass = `template-${String(org?.["template"] ?? "standard")}`;
  const layoutClass = `layout-${org?.["layout"] ?? "default"}`;
  const isChangeOrder = entityType === "change-orders";
  const currency = doc?.["currency"] ?? org?.["currency"] ?? "USD";
  const items: any[] = doc?.["items"] ?? [];
  const customer = doc?.["customer"];
  const project = doc?.["project"];
  const subtotal = Number(doc?.["subtotal"] ?? 0);
  const taxAmount = Number(doc?.["taxAmount"] ?? 0);
  const discount = Number(doc?.["discount"] ?? 0);
  const retainage = Number(doc?.["retainageAmount"] ?? 0);
  const total = Number(doc?.["total"] ?? doc?.["amount"] ?? 0);
  const accent = org?.["accentColor"] ?? ACCENT;

  return (
    <div
      className={`document-page ${templateClass} ${layoutClass}`}
      style={{
         width: paper.width,
         minHeight: paper.height,
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
           {doc?.["logoUrl"] && (
             // eslint-disable-next-line @next/next/no-img-element
             <img src={doc["logoUrl"]} alt={org?.["name"] ?? t["title"]} style={{ height: "4rem", width: "auto", objectFit: "contain" }} />
           )}
           <div>
             <p
               style={{
                 fontSize: "1.125rem",
                 fontWeight: 600,
                 color: org?.["brandColor"] ?? undefined,
               }}
             >
               {t["title"]}
             </p>
             <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>{org?.["name"] ?? "Prince"}</p>
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
              backgroundColor: accent,
              color: "white",
            }}
          >
            {t["title"]}
          </span>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.5rem" }}>{doc?.["number"] ?? "—"}</h2>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.25rem" }}>
            {t["issued"]} {formatDate(doc?.["issueDate"] ?? doc?.["createdAt"])}
          </p>
          {!isChangeOrder && doc?.["dueDate"] && (
            <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
              {t["due"]} {formatDate(doc["dueDate"])}
            </p>
          )}
          {!isChangeOrder && doc?.["validUntil"] && (
            <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
              {t["due"]} {formatDate(doc["validUntil"])}
            </p>
          )}
          {isChangeOrder && doc?.["status"] && (
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.25rem" }}>
              Status: {doc["status"]}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem", fontSize: "0.875rem" }}>
        <div>
          <p
            style={{
              fontWeight: 600,
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#9ca3af",
              marginBottom: "0.25rem",
            }}
          >
            {customer ? t["billTo"] : t["project"]}
          </p>
          {doc?.["billToAddress"] ? (
            <div style={{ whiteSpace: "pre-line" }}>{doc["billToAddress"]}</div>
          ) : customer ? (
            <>
              <p style={{ fontWeight: 500 }}>{customer?.["name"] ?? "Unknown"}</p>
              {customer?.["company"] && <p>{customer["company"]}</p>}
              {customer?.["email"] && <p>{customer["email"]}</p>}
              {customer?.["address"] && <p>{customer["address"]}</p>}
            </>
          ) : (
            <p style={{ color: "#6b7280" }}>—</p>
          )}
          {doc?.["shipToAddress"] && (
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e5e7eb" }}>
              <p
                style={{
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#9ca3af",
                  marginBottom: "0.25rem",
                }}
              >
                {t["shipTo"]}
              </p>
              <div style={{ whiteSpace: "pre-line" }}>{doc["shipToAddress"]}</div>
            </div>
          )}
        </div>
        <div>
          {project && (
            <div style={{ marginBottom: "1rem" }}>
              <p
                style={{
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#9ca3af",
                  marginBottom: "0.25rem",
                }}
              >
                {t["project"]}
              </p>
              <p>{project["name"]}</p>
            </div>
          )}
          {!isChangeOrder && doc?.["type"] != null && (
            <div>
              <p
                style={{
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#9ca3af",
                  marginBottom: "0.25rem",
                }}
              >
                {t["type"]}
              </p>
              <span
                className={getTypeBadgeClass(doc["type"])}
                style={{
                  display: "inline-block",
                  borderRadius: "9999px",
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  backgroundColor: accent,
                  color: "white",
                }}
              >
                {getTypeLabel(doc["type"], (key: string) => t[key] ?? key)}
              </span>
            </div>
          )}
        </div>
      </div>

      <table style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #d1d5db", textAlign: "left" }}>
            <th style={{ padding: "0.5rem 0", width: "2rem" }}>{"#"}</th>
            <th style={{ padding: "0.5rem 0" }}>{t["description"]}</th>
            <th style={{ padding: "0.5rem 0", textAlign: "right" }}>{t["qty"]}</th>
            <th style={{ padding: "0.5rem 0", textAlign: "right" }}>{t["unitPrice"]}</th>
            <th style={{ padding: "0.5rem 0", textAlign: "right" }}>{t["amount"]}</th>
          </tr>
        </thead>
        <tbody>
          {items["map"]((it: any, idx: number) => (
            <tr key={it?.["id"] ?? idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "0.5rem 0", color: "#9ca3af" }}>{idx + 1}</td>
              <td style={{ padding: "0.5rem 0" }}>{it?.["description"] ?? "—"}</td>
              <td style={{ padding: "0.5rem 0", textAlign: "right" }}>{it?.["quantity"] ?? ""}</td>
              <td style={{ padding: "0.5rem 0", textAlign: "right" }}>
                {formatCurrency(it?.["unitPrice"], currency)}
              </td>
              <td style={{ padding: "0.5rem 0", textAlign: "right", fontWeight: 500 }}>
                {formatCurrency(it?.["amount"], currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: isChangeOrder ? "12rem" : "18rem", fontSize: "0.875rem" }}>
          {isChangeOrder ? (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280" }}>{t["total"]}</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>{t["subtotal"]}</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>{t["tax"]}</span>
                <span>{formatCurrency(taxAmount, currency)}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>{t["discount"]}</span>
                  <span>-{formatCurrency(discount, currency)}</span>
                </div>
              )}
              {retainage > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>{t["retainage"]}</span>
                  <span>-{formatCurrency(retainage, currency)}</span>
                </div>
              )}
              <div
                style={{
                  borderTop: `2px solid ${accent}`,
                  paddingTop: "0.25rem",
                  marginTop: "0.25rem",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: accent,
                }}
              >
                <span>{t["total"]}</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {(doc?.["notes"] || doc?.["description"]) && (
        <div style={{ marginTop: "2rem", fontSize: "0.875rem" }}>
          <p
            style={{
              fontWeight: 600,
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#9ca3af",
              marginBottom: "0.25rem",
            }}
          >
            {t["notes"]}
          </p>
          <p style={{ color: "#4b5563", whiteSpace: "pre-line" }}>{doc?.["notes"] ?? doc?.["description"]}</p>
        </div>
      )}
    </div>
  );
}
