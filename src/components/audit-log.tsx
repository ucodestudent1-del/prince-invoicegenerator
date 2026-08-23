"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export function AuditLog({ invoiceId }: { invoiceId: string }) {
  const [logs, setLogs] = React["useState"]<any[]>([]);
  const [loading, setLoading] = React["useState"](true);

  React["useEffect"](() => {
    async function load() {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/audit`);
        if (res["ok"]) {
          const data = await res["json"]();
          setLogs(data);
        }
      } catch (err) {
        console["error"]("Failed to load audit logs", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [invoiceId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment & activity log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  if (logs["length"] === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment & activity log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment & activity log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {logs["map"]((log) => (
            <div key={log["id"]} className="border-b pb-2 last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{log["action"]["replace"](/_/g, " ")}</span>
                <span className="text-xs text-muted-foreground">{formatDate(log["createdAt"])}</span>
              </div>
              {(log["fromStatus"] || log["toStatus"]) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {log["fromStatus"] && <span>{log["fromStatus"]}</span>}
                  {log["fromStatus"] && log["toStatus"] && <span> → </span>}
                  {log["toStatus"] && <span>{log["toStatus"]}</span>}
                </p>
              )}
              {log["amount"] != null && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Amount: {new Intl["NumberFormat"]("en-US", { style: "currency", currency: "USD" })["format"](log["amount"])}
                </p>
              )}
              {log["note"] && <p className="text-xs text-muted-foreground mt-0.5">{log["note"]}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
