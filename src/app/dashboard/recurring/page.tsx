import Link from "next/link";
import { requireUser } from "@/lib/org";
import { getRecurringConfigs, toggleRecurringConfig, generateNextInvoice } from "@/lib/actions/recurring";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pause, Play, Zap } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { logServerError } from "@/lib/errors";

export default async function RecurringPage() {
  const user = await requireUser();
  if (!user.organizationId) return null;

  let configs;
  try {
    configs = await getRecurringConfigs();
  } catch (err) {
    logServerError("RecurringPage", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recurring invoices</h1>
        <Button asChild>
          <Link href="/dashboard/recurring/new">
            <Plus className="mr-2 h-4 w-4" /> New recurring config
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recurring configurations</CardTitle>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recurring invoice configurations yet. Create one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last invoice</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>{config.customer?.name ?? "—"}</TableCell>
                    <TableCell>{config.frequency}</TableCell>
                    <TableCell>{formatDate(config.nextRunDate)}</TableCell>
                    <TableCell>
                      <Badge variant={config.active ? "success" : "secondary"}>
                        {config.active ? "Active" : "Paused"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {config.lastInvoice ? (
                        <Link
                          href={`/dashboard/invoices/${config.lastInvoice.id}`}
                          className="text-primary hover:underline"
                        >
                          {config.lastInvoice.number}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {config.lastInvoice && (
                          <form
                            action={async () => {
                              "use server";
                              await generateNextInvoice(config.id);
                            }}
                          >
                            <Button type="submit" variant="outline" size="sm">
                              <Zap className="h-4 w-4" />
                            </Button>
                          </form>
                        )}
                        <form
                          action={async () => {
                            "use server";
                            await toggleRecurringConfig(config.id, !config.active);
                          }}
                        >
                          <Button type="submit" variant="outline" size="sm">
                            {config.active ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Create a recurring invoice configuration, then link existing invoices
            to it. The system will automatically generate new invoices based on
            the frequency you set. You can also trigger invoice generation manually
            using the lightning bolt icon.
          </p>
          <p>
            For automated invoice generation, set up a cron job to call{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">/api/invoices/recurring/generate</code>
            . Scheduled invoices are processed via{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">/api/invoices/scheduled</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
