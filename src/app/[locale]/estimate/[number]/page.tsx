"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Check, X, Share2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface EstimateItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
}

interface Customer {
  id: string;
  name?: string | null;
  company?: string | null;
  email?: string | null;
  address?: string | null;
}

interface Organization {
  name: string;
  logoUrl?: string | null;
}

interface EstimateData {
  id: string;
  number: string;
  status: string;
  issueDate: string;
  validUntil?: string | null;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  notes?: string | null;
  viewedAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  customer: Customer;
  org: Organization;
  items: EstimateItem[];
}

interface NotificationState {
  message: string;
  type: "success" | "error";
}

const statusConfig = {
  DRAFT: { color: "bg-gray-100 text-gray-800", label: "Draft" },
  SENT: { color: "bg-amber-100 text-amber-800", label: "Sent — awaiting your review" },
  VIEWED: { color: "bg-amber-100 text-amber-800", label: "Awaiting your approval" },
  ACCEPTED: { color: "bg-emerald-100 text-emerald-800", label: "Accepted" },
  REJECTED: { color: "bg-red-100 text-red-800", label: "Rejected" },
  EXPIRED: { color: "bg-gray-100 text-gray-500", label: "Expired" },
  INVOICED: { color: "bg-blue-100 text-blue-800", label: "Converted to Invoice" },
  DECLINED: { color: "bg-red-100 text-red-800", label: "Declined" },
} as Record<string, { color: string; label: string }>;

function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export default function EstimatePage({
  params,
  searchParams,
}: {
  params: { locale: string; number: string };
  searchParams: { token?: string };
}) {
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [acceptComment, setAcceptComment] = useState("");
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const token = searchParams["token"];

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`/api/estimates/view?token=${token}`)
      ["then"]((res) => res["json"]())
      ["then"]((data) => {
        if (data["error"]) {
          setNotification({ message: data["error"], type: "error" });
        } else {
          setEstimate(data);
        }
      })
      ["catch"](() => {
        setNotification({ message: "Could not load estimate", type: "error" });
      })
      ["finally"](() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setActionLoading("accept");
    const res = await fetch(`/api/estimates/accept?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON["stringify"]({ comment: acceptComment }),
    });
    const data = await res["json"]();
    if (data["error"]) {
      setNotification({ message: data["error"], type: "error" });
    } else {
      setEstimate((prev) =>
        prev ? { ...prev, status: "ACCEPTED", acceptedAt: new Date()["toISOString"]() } : prev
      );
      setNotification({ message: "Estimate Accepted — Thank you!", type: "success" });
    }
    setActionLoading(null);
    setShowAcceptDialog(false);
    setAcceptComment("");
  };

  const handleReject = async () => {
    setActionLoading("reject");
    const res = await fetch(`/api/estimates/reject?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON["stringify"]({ reason: rejectReason, comment: rejectComment }),
    });
    const data = await res["json"]();
    if (data["error"]) {
      setNotification({ message: data["error"], type: "error" });
    } else {
      setEstimate((prev) =>
        prev ? { ...prev, status: "REJECTED", rejectedAt: new Date()["toISOString"]() } : prev
      );
      setNotification({ message: "Feedback sent — your contractor has been notified.", type: "success" });
    }
    setActionLoading(null);
    setShowRejectDialog(false);
    setRejectReason("");
    setRejectComment("");
  };

  const handleShare = async () => {
    if (navigator["share"]) {
      await navigator["share"]({
        title: `Estimate ${estimate?.["number"]}`,
        text: `View estimate ${estimate?.["number"]} for ${formatCurrency(estimate?.["total"] ?? 0, estimate?.["currency"])}`,
        url: window["location"]["href"],
      });
    } else {
      await navigator["clipboard"]["writeText"](window["location"]["href"]);
      setNotification({ message: "Share link copied to clipboard", type: "success" });
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Invalid Link</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">This estimate link is missing a valid access token.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !estimate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading estimate...</p>
        </div>
      </div>
    );
  }

  const statusInfo = statusConfig[estimate["status"]] || statusConfig["DRAFT"];
  const isExpired =
    estimate["validUntil"] && new Date(estimate["validUntil"]) < new Date() &&
    ["SENT", "VIEWED"]["includes"](estimate["status"]);

  const canAcceptReject =
    ["SENT", "VIEWED"]["includes"](estimate["status"]) && !isExpired;

  const actionColorClass = "bg-emerald-600 hover:bg-emerald-700";
  const rejectColorClass = "border-red-200 text-red-700 hover:bg-red-50";

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {notification && (
          <div
            className={`mb-4 p-4 rounded-md flex items-center gap-2 text-sm ${
              notification["type"] === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {notification["type"] === "success" ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {notification["message"]}
          </div>
        )}

        {/* Expired banner sits above the document so it can't be missed. */}
        {isExpired && (
          <div className="mb-4 p-4 rounded-md flex items-start gap-2 border border-red-200 bg-red-50 text-sm">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">This estimate has expired.</p>
              <p className="text-red-700 mt-0.5">
                Valid until {formatDate(estimate["validUntil"])} has passed. Please request a new quote.
              </p>
            </div>
          </div>
        )}

        {/* Document shell — clean data-table layout, see estimate.css. */}
        <div className="bg-white border border-gray-200 rounded-md p-6 sm:p-10 shadow-sm">
          <div className="estimate-body">
            {/* Header */}
            <header className="estimate-header">
              <div className="brand">
                {estimate["org"]["logoUrl"] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={estimate["org"]["logoUrl"]}
                    alt={estimate["org"]["name"] || "Logo"}
                    className="brand-mark"
                  />
                )}
                <div className="brand-text">
                  <p className="brand-org">{estimate["org"]["name"] || "Prince Invoice Generator"}</p>
                  <p className="brand-doc-type">Estimate</p>
                </div>
              </div>
              <div className="doc-id">
                <span className="estimate-status" data-status={estimate["status"]}>
                  {statusInfo["label"]}
                </span>
                <h2 className="doc-number">{estimate["number"]}</h2>
                <p className="doc-issued">Issued {formatDate(estimate["issueDate"])}</p>
                {estimate["validUntil"] && (
                  <p className="doc-issued">Valid until {formatDate(estimate["validUntil"])}</p>
                )}
                {estimate["viewedAt"] && (
                  <p className="doc-issued">Viewed {formatDate(estimate["viewedAt"])}</p>
                )}
                {estimate["acceptedAt"] && (
                  <p className="doc-issued">Accepted {formatDate(estimate["acceptedAt"])}</p>
                )}
              </div>
            </header>

            {/* Meta summary table */}
            <table className="estimate-meta">
              <tbody>
                <tr>
                  <th scope="row">Bill To</th>
                  <td>
                    <strong>{estimate["customer"]["name"] || estimate["customer"]["company"] || "—"}</strong>
                    {estimate["customer"]["company"] && estimate["customer"]["name"] && (
                      <>
                        <br />
                        {estimate["customer"]["company"]}
                      </>
                    )}
                    {estimate["customer"]["email"] && (
                      <>
                        <br />
                        {estimate["customer"]["email"]}
                      </>
                    )}
                    {estimate["customer"]["address"] && (
                      <>
                        <br />
                        {estimate["customer"]["address"]}
                      </>
                    )}
                  </td>
                  <th scope="row">Details</th>
                  <td>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--est-muted)" }}>Currency</span>
                      <span>{estimate["currency"]}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--est-muted)" }}>Tax Rate</span>
                      <span>{estimate["taxRate"]}%</span>
                    </div>
                    {estimate["discount"] > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--est-muted)" }}>Discount</span>
                        <span>{formatCurrency(estimate["discount"], estimate["currency"])}</span>
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Line items + totals in one table */}
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
                  <th scope="col">Description</th>
                  <th scope="col" className="num">Qty</th>
                  <th scope="col" className="num">Unit Price</th>
                  <th scope="col" className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {estimate["items"]
                  ["slice"]()
                  ["sort"]((a, b) => a["sortOrder"] - b["sortOrder"])
                  ["map"]((item, idx) => (
                    <tr key={item["id"]}>
                      <td className="col-num" data-label="#">
                        {idx + 1}
                      </td>
                      <td className="col-desc" data-label="Description">
                        {item["description"]}
                      </td>
                      <td className="num col-qty" data-label="Qty">
                        {item["quantity"]}
                      </td>
                      <td className="num col-rate" data-label="Unit Price">
                        {formatCurrency(item["unitPrice"], estimate["currency"])}
                      </td>
                      <td className="num col-amount" data-label="Amount">
                        {formatCurrency(item["amount"], estimate["currency"])}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={4} className="label">
                    Subtotal
                  </th>
                  <td className="num">{formatCurrency(estimate["subtotal"], estimate["currency"])}</td>
                </tr>
                {estimate["taxAmount"] > 0 && (
                  <tr>
                    <th scope="row" colSpan={4} className="label">
                      Tax ({estimate["taxRate"]}%)
                    </th>
                    <td className="num">{formatCurrency(estimate["taxAmount"], estimate["currency"])}</td>
                  </tr>
                )}
                {estimate["discount"] > 0 && (
                  <tr>
                    <th scope="row" colSpan={4} className="label">
                      Discount
                    </th>
                    <td className="num">-{formatCurrency(estimate["discount"], estimate["currency"])}</td>
                  </tr>
                )}
                <tr className="grand-total">
                  <th scope="row" colSpan={4} className="label">
                    Total
                  </th>
                  <td className="num">{formatCurrency(estimate["total"], estimate["currency"])}</td>
                </tr>
              </tfoot>
            </table>

            {/* Notes & terms */}
            {estimate["notes"] && (
              <section className="estimate-notes">
                <h2>Notes & Terms</h2>
                <p>{estimate["notes"]}</p>
              </section>
            )}
          </div>

          {/* Accepted / Rejected / Invoiced status panels — sit below the
              document so they don't fight with the table. */}
          {estimate["status"] === "ACCEPTED" && (
            <div className="estimate-notes" style={{ borderColor: "#a7f3d0" }}>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-full">
                  <Check className="h-5 w-5 text-emerald-600" />
                </span>
                <div>
                  <h2 style={{ color: "#166534" }}>Accepted</h2>
                  <p style={{ color: "#15803d" }}>
                    Your estimate has been accepted. Your contractor has been notified and will prepare your invoice.
                  </p>
                </div>
              </div>
            </div>
          )}

          {estimate["status"] === "REJECTED" && (
            <div className="estimate-notes" style={{ borderColor: "#fecaca" }}>
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 bg-red-100 rounded-full flex-shrink-0">
                  <X className="h-5 w-5 text-red-600" />
                </span>
                <div>
                  <h2 style={{ color: "#991b1b" }}>Estimate Rejected</h2>
                  <p style={{ color: "#b91c1c" }}>
                    Your contractor has been notified of your feedback.
                  </p>
                  {estimate["rejectionReason"] && (
                    <p style={{ color: "#b91c1c", marginTop: "0.5rem" }}>
                      <strong>Your feedback:</strong> {estimate["rejectionReason"]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {estimate["status"] === "INVOICED" && (
            <div className="estimate-notes" style={{ borderColor: "#bfdbfe" }}>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                  <Check className="h-5 w-5 text-blue-600" />
                </span>
                <div>
                  <h2 style={{ color: "#1e40af" }}>Estimate Converted</h2>
                  <p style={{ color: "#1d4ed8" }}>
                    This estimate has been converted to an invoice. You will receive a separate notification.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action bar — outside the document so it doesn't print. */}
        {canAcceptReject && (
          <div className="estimate-actions">
            <Button
              size="lg"
              className={`${actionColorClass} text-white`}
              onClick={() => setShowAcceptDialog(true)}
              disabled={!!actionLoading}
            >
              <Check className="h-5 w-5 mr-2" />
              Accept Quote
            </Button>
            <Button
              variant="outline"
              size="lg"
              className={rejectColorClass}
              onClick={() => setShowRejectDialog(true)}
              disabled={!!actionLoading}
            >
              <X className="h-5 w-5 mr-2" />
              Reject / Request Changes
            </Button>
          </div>
        )}

        {/* Footer + share */}
        <div className="flex items-center justify-between mt-6">
          <p className="text-xs text-gray-400">This estimate was generated using Prince Invoice Generator</p>
          <Button variant="ghost" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-1" /> Share
          </Button>
        </div>
      </div>

      {/* Accept Modal */}
      <Modal
        open={showAcceptDialog}
        onClose={() => setShowAcceptDialog(false)}
        title="Confirm Acceptance"
        description={`You are about to accept estimate ${estimate["number"]} for ${formatCurrency(estimate["total"], estimate["currency"])}. Once accepted, this estimate will be converted to an invoice for payment.`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowAcceptDialog(false)}
              disabled={!!actionLoading}
            >
              Cancel
            </Button>
            <Button
              className={actionColorClass}
              onClick={handleAccept}
              disabled={!!actionLoading}
            >
              {actionLoading === "accept" ? "Processing..." : "Yes, Accept Quote"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Label htmlFor="acceptComment">Additional comments (optional)</Label>
          <Textarea
            id="acceptComment"
            placeholder="Any questions or special requests..."
            value={acceptComment}
            onChange={(e) => setAcceptComment(e["target"]["value"])}
          />
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        title="Request Changes or Reject"
        description="Please let us know why you're rejecting this estimate so we can address your concerns."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={!!actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className={rejectColorClass}
              onClick={handleReject}
              disabled={!!actionLoading || !rejectReason}
            >
              {actionLoading === "reject" ? "Processing..." : "Submit Feedback"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason for rejection</Label>
            <div className="flex flex-col space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rejectReason"
                  value="scope"
                  checked={rejectReason === "scope"}
                  onChange={(e) => setRejectReason(e["target"]["value"])}
                  className="form-radio h-4 w-4 text-emerald-600"
                />
                <span className="text-sm">Scope doesn&apos;t match my needs</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rejectReason"
                  value="price"
                  checked={rejectReason === "price"}
                  onChange={(e) => setRejectReason(e["target"]["value"])}
                  className="form-radio h-4 w-4 text-emerald-600"
                />
                <span className="text-sm">Price too high</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rejectReason"
                  value="better"
                  checked={rejectReason === "better"}
                  onChange={(e) => setRejectReason(e["target"]["value"])}
                  className="form-radio h-4 w-4 text-emerald-600"
                />
                <span className="text-sm">Found a better quote elsewhere</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rejectReason"
                  value="other"
                  checked={rejectReason === "other"}
                  onChange={(e) => setRejectReason(e["target"]["value"])}
                  className="form-radio h-4 w-4 text-emerald-600"
                />
                <span className="text-sm">Other reason</span>
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rejectComment">Additional details (optional)</Label>
            <Textarea
              id="rejectComment"
              placeholder="Please describe the changes you'd like..."
              value={rejectComment}
              onChange={(e) => setRejectComment(e["target"]["value"])}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
