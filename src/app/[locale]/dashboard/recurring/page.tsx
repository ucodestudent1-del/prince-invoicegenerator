import { Link } from "@/i18n/navigation";
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
import { getTranslations } from "next-intl/server";

export default async function RecurringPage({ params }: { params: { locale: string } }) {
  const user = await requireUser();
  if (!user || !user.organizationId) return null;
  const t = await getTranslations("recurring");

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
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button asChild>
          <Link href={`/${params.locale}/dashboard/recurring/new`}>
            <Plus className="mr-2 h-4 w-4" /> {t("newConfig")}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("configurations")}</CardTitle>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noConfigs")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("frequency")}</TableHead>
                  <TableHead>{t("nextRun")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("lastInvoice")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
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
                        {config.active ? t("active") : t("paused")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {config.lastInvoice ? (
                        <Link
                          href={`/${params.locale}/dashboard/invoices/${config.lastInvoice.id}`}
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
          <CardTitle className="text-lg">{t("howItWorks")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            {t("newConfigDesc")}
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
