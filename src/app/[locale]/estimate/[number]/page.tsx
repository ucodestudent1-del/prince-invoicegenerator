"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Check, X, Share2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            {estimate["org"]["logoUrl"] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={estimate["org"]["logoUrl"]}
                alt={estimate["org"]["name"] || "Logo"}
                className="h-10 w-auto object-contain"
              />
            )}
            <span className="text-lg font-semibold text-gray-700">
              {estimate["org"]["name"] || "Prince Invoice Generator"}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-1" /> Share
          </Button>
        </div>

        {/* Estimate Header */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Estimate {estimate["number"]}</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Issued on {formatDate(estimate["issueDate"])}
              </p>
            </div>
            <Badge className={statusInfo["color"]}>{statusInfo["label"]}</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm text-gray-600">
              <div>
                <span className="font-medium">Valid until:</span> {formatDate(estimate["validUntil"])}
              </div>
              {estimate["viewedAt"] && (
                <div>
                  <span className="font-medium">Viewed:</span> {formatDate(estimate["viewedAt"])}
                </div>
              )}
              {estimate["acceptedAt"] && (
                <div>
                  <span className="font-medium">Accepted:</span> {formatDate(estimate["acceptedAt"])}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Expired Banner */}
        {isExpired && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">This estimate has expired.</p>
              </div>
              <p className="text-sm text-red-700 mt-1">
                Valid until {formatDate(estimate["validUntil"])} has passed. Please request a new quote.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Customer Info & Estimate Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Bill To
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{estimate["customer"]["name"] || estimate["customer"]["company"] || "—"}</p>
              {estimate["customer"]["company"] && estimate["customer"]["name"] && (
                <p className="text-gray-600">{estimate["customer"]["company"]}</p>
              )}
              {estimate["customer"]["email"] && <p className="text-gray-500">{estimate["customer"]["email"]}</p>}
              {estimate["customer"]["address"] && <p className="text-gray-500">{estimate["customer"]["address"]}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Estimate Details
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Currency:</span>
                <span>{estimate["currency"]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tax Rate:</span>
                <span>{estimate["taxRate"]}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Discount:</span>
                <span>{formatCurrency(estimate["discount"], estimate["currency"])}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Items */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200 text-left">
                  <th className="pb-2">#</th>
                  <th className="pb-2">Description</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Unit Price</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {estimate["items"]
                  ["slice"]()
                  ["sort"]((a, b) => a["sortOrder"] - b["sortOrder"])
                  ["map"]((item, idx) => (
                    <tr key={item["id"]} className="border-b border-gray-100">
                      <td className="py-3 text-gray-400">{idx + 1}</td>
                      <td className="py-3">{item["description"]}</td>
                      <td className="py-3 text-right">{item["quantity"]}</td>
                      <td className="py-3 text-right">
                        {formatCurrency(item["unitPrice"], estimate["currency"])}
                      </td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(item["amount"], estimate["currency"])}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(estimate["subtotal"], estimate["currency"])}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tax ({estimate["taxRate"]}%)</span>
                  <span>{formatCurrency(estimate["taxAmount"], estimate["currency"])}</span>
                </div>
                {estimate["discount"] > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Discount</span>
                    <span>-{formatCurrency(estimate["discount"], estimate["currency"])}</span>
                  </div>
                )}
                <div className="border-t-2 pt-2 flex justify-between text-lg font-bold">
                  <span>TOTAL</span>
                  <span>{formatCurrency(estimate["total"], estimate["currency"])}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {estimate["notes"] && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Notes & Terms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-line text-sm">{estimate["notes"]}</p>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {canAcceptReject && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex gap-4 justify-center">
                <Button
                  size="lg"
                  className={`${actionColorClass} text-white px-8`}
                  onClick={() => setShowAcceptDialog(true)}
                >
                  <Check className="h-5 w-5 mr-2" />
                  Accept Quote
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className={rejectColorClass}
                  onClick={() => setShowRejectDialog(true)}
                >
                  <X className="h-5 w-5 mr-2" />
                  Reject / Request Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Accepted State */}
        {estimate["status"] === "ACCEPTED" && (
          <Card className="mb-6 border-emerald-200 bg-emerald-50">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full mb-3">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-emerald-800 mb-1">Thank you!</h3>
              <p className="text-sm text-emerald-700">
                Your estimate has been accepted. Your contractor has been notified and will prepare your invoice.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Rejected State */}
        {estimate["status"] === "REJECTED" && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <X className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-800 mb-1">Estimate Rejected</h3>
                  <p className="text-sm text-red-700 mb-2">
                    Your contractor has been notified of your feedback.
                  </p>
                  {estimate["rejectionReason"] && (
                    <p className="text-sm text-red-700">
                      <span className="font-medium">Your feedback:</span> {estimate["rejectionReason"]}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Converted State */}
        {estimate["status"] === "INVOICED" && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-blue-800">Estimate Converted</h3>
                  <p className="text-sm text-blue-700">
                    This estimate has been converted to an invoice. You will receive a separate notification.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-400">
          <p>This estimate was generated using Prince Invoice Generator</p>
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
