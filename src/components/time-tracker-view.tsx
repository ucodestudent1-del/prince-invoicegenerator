"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { Check, Edit3, Trash2 } from "lucide-react";
import { updateTimeEntry, deleteTimeEntry, approveTimeEntries } from "@/lib/actions/time-tracking";

interface TimeEntryWithRelations {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  description: string | null;
  billable: boolean;
  hourlyRate: number;
  amount: number;
  isManual: boolean;
  status: string;
  userId: string;
  projectId: string;
  user?: { id: string; name: string | null; email: string | null };
  project?: { id: string; name: string; customerId: string | null; customer?: { name: string | null } };
}

export function TimeTrackerView({
  initialEntries = [],
  canApprove,
  userId,
}: {
  initialEntries?: TimeEntryWithRelations[];
  canApprove: boolean;
  userId: string;
}) {
  const [entries, setEntries] = React["useState"]<TimeEntryWithRelations[]>(initialEntries);
  const [editingId, setEditingId] = React["useState"]<string | null>(null);
  const [editData, setEditData] = React["useState"]<Partial<TimeEntryWithRelations>>({});
  const [selected, setSelected] = React["useState"]<Set<string>>(new Set());

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      APPROVED: "default",
      PENDING_APPROVAL: "secondary",
      INVOICED: "outline",
      REJECTED: "destructive",
      DRAFT: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"} className="text-xs">{status["replace"]("_", " ")}</Badge>;
  };

  const formatDuration = (seconds: number) => {
    const h = Math["floor"](seconds / 3600);
    const m = Math["floor"]((seconds % 3600) / 60);
    const s = Math["floor"](seconds % 60);
    return `${h["toString"]()["padStart"](2, "0")}:${m["toString"]()["padStart"](2, "0")}:${s["toString"]()["padStart"](2, "0")}`;
  };

  const startEdit = (entry: TimeEntryWithRelations) => {
    setEditingId(entry["id"]);
    setEditData({
      description: entry["description"],
      billable: entry["billable"],
      hourlyRate: entry["hourlyRate"],
      status: entry["status"],
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await updateTimeEntry(editingId, {
        description: editData["description"],
        billable: editData["billable"],
        hourlyRate: editData["hourlyRate"],
        status: editData["status"] as any,
      });
      setEntries(
        entries["map"]((e) =>
          e["id"] === editingId
            ? { ...e, ...editData }
            : e
        ) as TimeEntryWithRelations[]
      );
      setEditingId(null);
      setEditData({});
    } catch (err: any) {
      console["error"]("Failed to update entry:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this time entry?")) return;
    try {
      await deleteTimeEntry(id);
      setEntries(entries["filter"]((e) => e["id"] !== id));
    } catch (err: any) {
      console["error"]("Failed to delete:", err);
    }
  };

  const handleApproveSelected = async () => {
    const ids = Array["from"](selected);
    if (ids["length"] === 0) return;
    try {
      await approveTimeEntries(ids);
      setEntries(
        entries["map"]((e) =>
          selected["has"](e["id"]) ? { ...e, status: "APPROVED" } : e
        )
      );
      setSelected(new Set());
    } catch (err: any) {
      console["error"]("Failed to approve:", err);
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next["has"](id)) next["delete"](id);
      else next["add"](id);
      return next;
    });
  };

  const totalBillable = entries
    ["filter"]((e) => e["billable"])
    ["reduce"]((sum, e) => sum + e["amount"], 0);

  return (
    <div className="space-y-4">
      {canApprove && selected["size"] > 0 && (
        <div className="flex items-center justify-between bg-blue-50 p-3 rounded-md">
          <span className="text-sm">{selected["size"]} selected</span>
          <Button size="sm" onClick={handleApproveSelected}>
            Approve Selected
          </Button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Recent Entries</h2>
        <Badge variant="secondary">
          Total billable: {formatCurrency(totalBillable)}
        </Badge>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                {canApprove && <TableHead className="w-6" />}
                <TableHead>Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Billable</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries["length"] === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No time entries yet.
                  </TableCell>
                </TableRow>
              ) : (
                entries["map"]((entry) => (
                  <TableRow key={entry["id"]}>
                    {canApprove && (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected["has"](entry["id"])}
                          onChange={() => toggleSelected(entry["id"])}
                          disabled={entry["status"] === "INVOICED"}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      {new Date(entry["startTime"])["toLocaleDateString"]()}
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{formatDuration(entry["duration"])}</code>
                    </TableCell>
                    <TableCell>{entry["project"]?.["name"] || "—"}</TableCell>
                    <TableCell>
                      {editingId === entry["id"] ? (
                        <Input
                          value={editData["description"] ?? ""}
                          onChange={(e) => setEditData({ ...editData, description: e["target"]["value"] })}
                          className="text-sm"
                        />
                      ) : (
                        entry["description"]
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === entry["id"] ? (
                        <Input
                          type="number"
                          value={editData["hourlyRate"] ?? ""}
                          onChange={(e) => setEditData({ ...editData, hourlyRate: Number(e["target"]["value"]) })}
                          className="w-20 text-sm"
                        />
                      ) : (
                        formatCurrency(entry["hourlyRate"])
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(entry["amount"])}</TableCell>
                    <TableCell>
                      {editingId === entry["id"] ? (
                        <Select
                          value={String(editData["billable"])}
                          onValueChange={(v) => setEditData({ ...editData, billable: v === "true" })}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        entry["billable"] ? "Yes" : "No"
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === entry["id"] ? (
                        <Select
                          value={editData["status"] ?? entry["status"]}
                          onValueChange={(v) => setEditData({ ...editData, status: v as any })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="APPROVED">Approved</SelectItem>
                            <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                            <SelectItem value="REJECTED">Rejected</SelectItem>
                            <SelectItem value="INVOICED">Invoiced</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        getStatusBadge(entry["status"])
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === entry["id"] ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={saveEdit}>
                            <Check className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(entry)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(entry["id"])}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
