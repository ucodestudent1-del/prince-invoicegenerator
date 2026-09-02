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
    issued: "Date",
    due: "Effective",
    billTo: "Owner",
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
    total: "Total Change",
    notes: "Notes",
    poweredBy: "Powered by Prince",
  },
};

const ACCENT = "#3b82f6";

/**
 * Estimate body — clean data-table layout.
 *
 * Used by both the public acceptance page and the dashboard print + PDF
 * pipeline. The CSS lives in `src/styles/estimate.css` and is scoped to
 * `.estimate-*` so it never leaks into invoice templates.
 */
function EstimateDocumentBody({
  doc,
  org,
  labels,
  currency,
  accent,
  showStatus = true,
}: {
  doc: any;
  org?: any;
  labels: Record<string, string>;
  currency: string;
  accent: string;
  showStatus?: boolean;
}) {
  const items: any[] = doc?.["items"] ?? [];
  const customer = doc?.["customer"];
  const project = doc?.["project"];
  const subtotal = Number(doc?.["subtotal"] ?? 0);
  const taxAmount = Number(doc?.["taxAmount"] ?? 0);
  const taxRate = Number(doc?.["taxRate"] ?? 0);
  const discount = Number(doc?.["discount"] ?? 0);
  const total = Number(doc?.["total"] ?? doc?.["amount"] ?? 0);
  const billToText = doc?.["billToAddress"] as string | undefined;
  const shipToText = doc?.["shipToAddress"] as string | undefined;

  return (
    <div
      className="estimate-body"
      style={
        {
          fontFamily: org?.["fontFamily"] ? quoteFontFamily(org["fontFamily"]) : "'Inter', system-ui, sans-serif",
          fontSize: "10pt",
          lineHeight: 1.4,
          // Surface the org accent as a CSS custom property so
          // `.estimate-items tfoot tr.grand-total` picks it up.
          ["--est-accent" as any]: accent,
        } as React.CSSProperties
      }
    >
      {/* Header */}
      <header className="estimate-header">
        <div className="brand">
          {doc?.["logoUrl"] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={doc["logoUrl"]}
              alt={org?.["name"] ?? labels["title"]}
              className="brand-mark"
            />
          )}
          <div className="brand-text">
            <p className="brand-org">{org?.["name"] ?? "Prince"}</p>
            <p className="brand-doc-type">{labels["title"]}</p>
          </div>
        </div>
        <div className="doc-id">
          {showStatus && doc?.["status"] && (
            <span className="estimate-status" data-status={doc["status"]}>
              {doc["status"]}
            </span>
          )}
          <h2 className="doc-number">{doc?.["number"] ?? "—"}</h2>
          <p className="doc-issued">
            {labels["issued"]} {formatDate(doc?.["issueDate"] ?? doc?.["createdAt"])}
          </p>
          {doc?.["validUntil"] && (
            <p className="doc-issued">
              {labels["due"]} {formatDate(doc["validUntil"])}
            </p>
          )}
        </div>
      </header>

      {/* Meta summary */}
      <table className="estimate-meta">
        <tbody>
          <tr>
            <th scope="row">{labels["billTo"]}</th>
            <td>
              {billToText ? (
                <div style={{ whiteSpace: "pre-line" }}>{billToText}</div>
              ) : customer ? (
                <>
                  <strong>{customer?.["name"] ?? "Unknown"}</strong>
                  {customer?.["company"] && (
                    <>
                      <br />
                      {customer["company"]}
                    </>
                  )}
                  {customer?.["email"] && (
                    <>
                      <br />
                      {customer["email"]}
                    </>
                  )}
                  {customer?.["address"] && (
                    <>
                      <br />
                      {customer["address"]}
                    </>
                  )}
                </>
              ) : (
                <span style={{ color: "var(--est-muted)" }}>—</span>
              )}
            </td>
            {project && (
              <>
                <th scope="row">{labels["project"]}</th>
                <td>{project["name"]}</td>
              </>
            )}
          </tr>
          {shipToText && (
            <tr>
              <th scope="row">{labels["shipTo"]}</th>
              <td colSpan={project ? 3 : 1}>
                <div style={{ whiteSpace: "pre-line" }}>{shipToText}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Line items */}
      <table className="estimate-items">
        <colgroup>
          <col className="col-num" />
          <col className="col-desc" />
          <col className="col-qty" />
          <col className="col-rate" />
          <col className="col-amount" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{labels["description"]}</th>
            <th scope="col" className="num">
              {labels["qty"]}
            </th>
            <th scope="col" className="num">
              {labels["unitPrice"]}
            </th>
            <th scope="col" className="num">
              {labels["amount"]}
            </th>
          </tr>
        </thead>
        <tbody>
          {items["map"]((it: any, idx: number) => (
            <tr key={it?.["id"] ?? idx}>
              <td className="col-num" data-label="#">
                {idx + 1}
              </td>
              <td className="col-desc" data-label={labels["description"]}>
                {it?.["description"] ?? "—"}
              </td>
              <td className="num col-qty" data-label={labels["qty"]}>
                {it?.["quantity"] ?? ""}
              </td>
              <td className="num col-rate" data-label={labels["unitPrice"]}>
                {formatCurrency(it?.["unitPrice"], currency)}
              </td>
              <td className="num col-amount" data-label={labels["amount"]}>
                {formatCurrency(it?.["amount"], currency)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={4} className="label">
              {labels["subtotal"]}
            </th>
            <td className="num">{formatCurrency(subtotal, currency)}</td>
          </tr>
          {taxAmount > 0 && (
            <tr>
              <th scope="row" colSpan={4} className="label">
                {labels["tax"]}
                {taxRate > 0 ? ` (${taxRate}%)` : ""}
              </th>
              <td className="num">{formatCurrency(taxAmount, currency)}</td>
            </tr>
          )}
          {discount > 0 && (
            <tr>
              <th scope="row" colSpan={4} className="label">
                {labels["discount"]}
              </th>
              <td className="num">-{formatCurrency(discount, currency)}</td>
            </tr>
          )}
          <tr className="grand-total">
            <th scope="row" colSpan={4} className="label">
              {labels["total"]}
            </th>
            <td className="num">{formatCurrency(total, currency)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Notes */}
      {(doc?.["notes"] || doc?.["description"]) && (
        <section className="estimate-notes">
          <h2>{labels["notes"]}</h2>
          <p>{doc?.["notes"] ?? doc?.["description"]}</p>
        </section>
      )}
    </div>
  );
}

/**
 * Change Order body — traditional construction-document layout.
 *
 * Sections, in order:
 *   1. Centered title with CO number
 *   2. Meta strip (date, status, linked invoice)
 *   3. Contractor / Owner parties
 *   4. Project info
 *   5. Description of change (narrative)
 *   6. Schedule impact strip
 *   7. Cost impact table (with subtotal / total)
 *   8. Standard terms
 *   9. Signature blocks (Contractor / Owner)
 *
 * The cost table accepts an optional `items` array. When absent (the
 * common case for change orders that are priced as a single lump sum) a
 * single "Change order amount" row is rendered so the totals still sit
 * in a proper `tfoot` and behave correctly on print.
 */
function ChangeOrderDocumentBody({
  doc,
  org,
  labels,
  currency,
}: {
  doc: any;
  org?: any;
  labels: Record<string, string>;
  currency: string;
}) {
  const items: any[] = doc?.["items"] ?? [];
  const customer = doc?.["customer"];
  const project = doc?.["project"];
  const amount = Number(doc?.["amount"] ?? 0);
  const total = Number(doc?.["total"] ?? amount);
  const issueDate = doc?.["issueDate"] ?? doc?.["createdAt"];
  const effectiveDate = doc?.["effectiveDate"] ?? doc?.["dueDate"] ?? issueDate;
  const linkedInvoice = doc?.["invoice"];
  const description = doc?.["description"] as string | undefined;
  const title = doc?.["title"] as string | undefined;

  // When no items, render a single synthetic row so the totals table
  // is never empty and the line "Change order amount" still appears in
  // the document body for the print/PDF consumer.
  const rows: Array<{
    key: string;
    description: string;
    qty: number | string;
    unitPrice: number;
    amount: number;
  }> =
    items.length > 0
      ? items.map((it, idx) => ({
          key: it?.["id"] ?? `it-${idx}`,
          description: it?.["description"] ?? "—",
          qty: it?.["quantity"] ?? "",
          unitPrice: Number(it?.["unitPrice"] ?? 0),
          amount: Number(it?.["amount"] ?? 0),
        }))
      : [
          {
            key: "lump",
            description: title || labels["title"],
            qty: 1,
            unitPrice: amount,
            amount: total,
          },
        ];

  return (
    <div
      className="co-body"
      style={{
        fontFamily: org?.["fontFamily"] ? quoteFontFamily(org["fontFamily"]) : "'Inter', system-ui, sans-serif",
      }}
    >
      {/* 1. Title */}
      <div className="co-title">
        <h1>Change Order</h1>
        <div className="co-number">
          <span>No. {doc?.["number"] ?? "—"}</span>
          {doc?.["status"] && (
            <>
              {" · "}
              <span className="co-status" data-status={doc["status"]}>
                {doc["status"]}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. Meta strip */}
      <section className="co-section" aria-labelledby="co-meta-title">
        <h2 id="co-meta-title" className="co-section-title">
          Reference
        </h2>
        <div className="co-meta">
          <div className="co-meta-item">
            <span className="co-meta-label">Date</span>
            <span className="co-meta-value">{formatDate(issueDate)}</span>
          </div>
          <div className="co-meta-item">
            <span className="co-meta-label">Effective</span>
            <span className="co-meta-value">{formatDate(effectiveDate)}</span>
          </div>
          <div className="co-meta-item">
            <span className="co-meta-label">Linked Invoice</span>
            <span className="co-meta-value">
              {linkedInvoice ? `#${linkedInvoice["number"]}` : "—"}
            </span>
          </div>
        </div>
      </section>

      {/* 3. Parties */}
      <section className="co-section" aria-labelledby="co-parties-title">
        <h2 id="co-parties-title" className="co-section-title">
          Parties
        </h2>
        <div className="co-parties">
          <div className="co-party">
            <div className="co-party-label">Contractor</div>
            {org?.["name"] ? (
              <>
                <div className="co-party-line">
                  <strong>{org["name"]}</strong>
                </div>
                {org?.["address"] && <div className="co-party-line">{org["address"]}</div>}
                {org?.["phone"] && <div className="co-party-line">{org["phone"]}</div>}
                {org?.["email"] && <div className="co-party-line">{org["email"]}</div>}
              </>
            ) : (
              <div className="co-party-line">—</div>
            )}
          </div>
          <div className="co-party">
            <div className="co-party-label">Owner</div>
            {customer ? (
              <>
                <div className="co-party-line">
                  <strong>{customer?.["name"] ?? customer?.["company"] ?? "—"}</strong>
                </div>
                {customer?.["company"] && customer?.["name"] && (
                  <div className="co-party-line">{customer["company"]}</div>
                )}
                {customer?.["address"] && <div className="co-party-line">{customer["address"]}</div>}
                {customer?.["email"] && <div className="co-party-line">{customer["email"]}</div>}
              </>
            ) : (
              <div className="co-party-line">—</div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Project */}
      <section className="co-section" aria-labelledby="co-project-title">
        <h2 id="co-project-title" className="co-section-title">
          Project
        </h2>
        <div className="co-project">
          <div className="co-meta-item">
            <span className="co-meta-label">Project Name</span>
            <span className="co-meta-value">{project?.["name"] ?? "—"}</span>
          </div>
          <div className="co-meta-item">
            <span className="co-meta-label">Project #</span>
            <span className="co-meta-value">{project?.["number"] ?? doc?.["projectId"] ?? "—"}</span>
          </div>
          {doc?.["billToAddress"] && (
            <div className="co-meta-item" style={{ gridColumn: "1 / -1" }}>
              <span className="co-meta-label">Site Address</span>
              <span className="co-meta-value" style={{ whiteSpace: "pre-line" }}>
                {doc["billToAddress"]}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 5. Description */}
      {description && (
        <section className="co-section" aria-labelledby="co-desc-title">
          <h2 id="co-desc-title" className="co-section-title">
            Description of Change
          </h2>
          <p className="co-narrative">{description}</p>
        </section>
      )}

      {/* 6. Schedule impact */}
      <section className="co-section" aria-labelledby="co-sched-title">
        <h2 id="co-sched-title" className="co-section-title">
          Schedule Impact
        </h2>
        <div className="co-schedule">
          <div className="co-meta-item">
            <span className="co-meta-label">Days Added</span>
            <span className="co-meta-value">
              {doc?.["daysAdded"] != null ? `+${doc["daysAdded"]}` : "—"}
            </span>
          </div>
          <div className="co-meta-item">
            <span className="co-meta-label">New Completion</span>
            <span className="co-meta-value">
              {doc?.["newCompletionDate"] ? formatDate(doc["newCompletionDate"]) : "—"}
            </span>
          </div>
          <div className="co-meta-item">
            <span className="co-meta-label">Original Completion</span>
            <span className="co-meta-value">
              {doc?.["originalCompletionDate"] ? formatDate(doc["originalCompletionDate"]) : "—"}
            </span>
          </div>
        </div>
      </section>

      {/* 7. Cost impact */}
      <section className="co-section" aria-labelledby="co-cost-title">
        <h2 id="co-cost-title" className="co-section-title">
          Cost Impact
        </h2>
        <table className="co-cost-table">
          <colgroup>
            <col className="co-col-num" />
            <col className="co-col-desc" />
            <col className="co-col-qty" />
            <col className="co-col-unit" />
            <col className="co-col-amount" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{"#"}</th>
              <th scope="col">Item</th>
              <th scope="col" className="num">
                {labels["qty"]}
              </th>
              <th scope="col" className="num">
                {labels["unitPrice"]}
              </th>
              <th scope="col" className="num">
                {labels["amount"]}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.key}>
                <td className="co-col-num">{idx + 1}</td>
                <td>{row.description}</td>
                <td className="num">{row.qty || ""}</td>
                <td className="num">{formatCurrency(row.unitPrice, currency)}</td>
                <td className="num">{formatCurrency(row.amount, currency)}</td>
              </tr>
            ))}
           </tbody>
           <tfoot>
             <tr className="grand-total">
               <th scope="row" colSpan={4} className="label">
                 {labels["total"]}
               </th>
               <td className="num">{formatCurrency(total, currency)}</td>
             </tr>
           </tfoot>
         </table>

         {/* Financial Impact breakdown */}
         {(doc?.["originalTotal"] != null || doc?.["changeAmount"] != null || doc?.["revisedTotal"] != null) && (
           <div className="co-financial-impact" style={{ marginTop: "1rem", borderTop: "1px solid #e5e7eb", paddingTop: "0.75rem" }}>
             <div className="co-meta" style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
               {doc?.["originalTotal"] != null && (
                 <div className="co-meta-item">
                   <span className="co-meta-label">Original Contract Price</span>
                   <span className="co-meta-value">{formatCurrency(Number(doc["originalTotal"]), currency)}</span>
                 </div>
               )}
               {doc?.["changeAmount"] != null && (
                 <div className="co-meta-item">
                   <span className="co-meta-label">Change Amount</span>
                   <span className="co-meta-value">{formatCurrency(Number(doc["changeAmount"]), currency)}</span>
                 </div>
               )}
               {doc?.["revisedTotal"] != null && (
                 <div className="co-meta-item">
                   <span className="co-meta-label">New Contract Price</span>
                   <span className="co-meta-value font-semibold">{formatCurrency(Number(doc["revisedTotal"]), currency)}</span>
                 </div>
               )}
             </div>
           </div>
         )}
       </section>

      {/* 8. Terms */}
      <section className="co-section" aria-labelledby="co-terms-title">
        <h2 id="co-terms-title" className="co-section-title">
          Terms
        </h2>
        <p className="co-terms">
          The work described above shall be performed at the price stated and, upon
          acceptance, incorporated into the original contract. The contract
          completion date is adjusted as shown in the Schedule Impact. This
          change order becomes binding when signed by both parties below; payment
          terms remain as originally agreed unless otherwise noted.
        </p>
      </section>

      {/* 9. Signatures */}
      <section className="co-signatures" aria-label="Signatures">
        <div className="co-signature">
          <span className="co-sig-role">Contractor</span>
          <div className="co-sig-line" />
          <span className="co-sig-line-name">Signature · Date</span>
          <div className="co-sig-line" style={{ marginTop: "0.5rem" }} />
          <span className="co-sig-line-name">Printed Name</span>
        </div>
        <div className="co-signature">
          <span className="co-sig-role">Owner / Authorized Representative</span>
          <div className="co-sig-line" />
          <span className="co-sig-line-name">Signature · Date</span>
          <div className="co-sig-line" style={{ marginTop: "0.5rem" }} />
          <span className="co-sig-line-name">Printed Name</span>
        </div>
      </section>
    </div>
  );
}

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
  const isEstimate = entityType === "estimates";
  const currency = doc?.["currency"] ?? org?.["currency"] ?? "USD";
  const accent = org?.["accentColor"] ?? ACCENT;

  // Estimates and change orders use dedicated, document-specific layouts.
  // Invoices keep the existing card-based template.
  if (isEstimate || isChangeOrder) {
    return (
      <div
        className={`document-page ${isEstimate ? "estimate-document" : "change-order-document"} ${templateClass} ${layoutClass}`}
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
        {isEstimate ? (
          <EstimateDocumentBody
            doc={doc}
            org={org}
            labels={t}
            currency={currency}
            accent={accent}
          />
        ) : (
          <ChangeOrderDocumentBody doc={doc} org={org} labels={t} currency={currency} />
        )}
      </div>
    );
  }

  const items: any[] = doc?.["items"] ?? [];
  const customer = doc?.["customer"];
  const project = doc?.["project"];
  const subtotal = Number(doc?.["subtotal"] ?? 0);
  const taxAmount = Number(doc?.["taxAmount"] ?? 0);
  const discount = Number(doc?.["discount"] ?? 0);
  const retainage = Number(doc?.["retainageAmount"] ?? 0);
  const total = Number(doc?.["total"] ?? doc?.["amount"] ?? 0);

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
