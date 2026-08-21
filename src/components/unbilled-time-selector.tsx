"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Clock, Search, Check, X } from "lucide-react";

interface ProjectInfo {
  id: string;
  name: string;
  customerId?: string | null;
  customer?: { name: string | null };
}

interface UserInfo {
  id: string;
  name: string | null;
  email: string | null;
}

interface TimeEntryForInvoice {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  description: string | null;
  billable: boolean;
  hourlyRate: number;
  amount: number;
  project?: ProjectInfo;
  user?: UserInfo;
}

interface UnbilledTimeSelectorProps {
  entries: TimeEntryForInvoice[];
  onSelect: (selectedEntries: TimeEntryForInvoice[]) => void;
  trigger?: React.ReactNode;
}

export function UnbilledTimeSelector({ entries, onSelect, trigger }: UnbilledTimeSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const filteredEntries = entries.filter(
    (entry) =>
      entry.project?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.user?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelection = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDone = () => {
    const selectedEntries = entries.filter((e) => selected.has(e.id));
    onSelect(selectedEntries);
    setOpen(false);
    setSelected(new Set());
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const totalAmount = Array.from(selected)
    .map((id) => entries.find((e) => e.id === id))
    .filter(Boolean)
    .reduce((sum, e) => sum + (e?.amount || 0), 0);

  return (
    <>
      {trigger !== undefined ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Clock className="h-4 w-4 mr-1" />
          Add Tracked Time
        </Button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b">
              <h2 className="text-xl font-semibold">Add Tracked Time</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Select approved billable hours to add to this invoice.
              </p>
            </div>

            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by project, description, or user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-[50vh]">
              {filteredEntries.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No unbilled time entries found.
                </div>
              ) : (
                <div className="py-1">
                  {filteredEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 p-3 hover:bg-gray-50"
                    >
                      <div className="flex items-start pt-1">
                        <input
                          type="checkbox"
                          checked={selected.has(entry.id)}
                          onChange={() => toggleSelection(entry.id)}
                          className="mt-0.5"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.project?.name || "—"}</span>
                          {entry.user?.name && (
                            <Badge variant="outline" className="text-xs">
                              {entry.user.name}
                            </Badge>
                          )}
                        </div>
                        {entry.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {entry.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{formatDuration(entry.duration)}</span>
                          <span>{formatCurrency(entry.hourlyRate)}/hr</span>
                          {entry.project?.customer?.name && (
                            <span>Client: {entry.project.customer.name}</span>
                          )}
                        </div>
                        <div className="mt-1 font-medium text-sm">
                          {formatCurrency(entry.amount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">
                    {selected.size} {selected.size === 1 ? "entry" : "entries"} selected
                  </span>
                  {selected.size > 0 && (
                    <span className="font-medium ml-2">
                      Total: {formatCurrency(totalAmount)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleDone}
                    disabled={selected.size === 0}
                  >
                    <Check className="h-4 w-4 mr-1" /> Add to Invoice
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
