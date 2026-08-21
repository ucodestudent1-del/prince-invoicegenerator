"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export function EstimateAuditLog({ estimateId }: { estimateId: string }) {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/estimates/${estimateId}/audit`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data);
        }
      } catch (err) {
        console.error("Failed to load audit logs", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [estimateId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity log</CardTitle>
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
        <CardTitle className="text-base">Activity log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="border-b pb-2 last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{log.action.replace(/_/g, " ")}</span>
                <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
              </div>
              {(log.fromStatus || log.toStatus) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {log.fromStatus && <span>{log.fromStatus}</span>}
                  {log.fromStatus && log.toStatus && <span> → </span>}
                  {log.toStatus && <span>{log.toStatus}</span>}
                </p>
              )}
              {log.note && <p className="text-xs text-muted-foreground mt-0.5">{log.note}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
