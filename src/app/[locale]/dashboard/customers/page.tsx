import { Link } from "@/i18n/navigation";
import { requireUser, getActivePlan } from "@/lib/org";
import { db } from "@/lib/db";
import { deleteCustomer } from "@/lib/actions/customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, MapPin } from "lucide-react";
import { logServerError } from "@/lib/errors";
import { hasFeature } from "@/lib/plans";
import { getTranslations } from "next-intl/server";

export default async function CustomersPage({ params }: { params: { locale: string } }) {
  const user = await requireUser();
  if (!user || !user.organizationId) return null;
  const orgId = user.organizationId;
  const t = await getTranslations("customers");

  let customers;
  try {
    const plan = await getActivePlan(user);
    const includeAddresses = hasFeature(plan, "savedAddresses");
    if (includeAddresses) {
      try {
        customers = await db.customer.findMany({
          where: { orgId },
          orderBy: { name: "asc" },
          include: {
            _count: { select: { invoices: true } },
            addresses: { where: { orgId } },
          },
        });
      } catch (addrErr: any) {
        if (addrErr?.message?.includes("CustomerAddress") || addrErr?.message?.includes("does not exist")) {
          customers = await db.customer.findMany({
            where: { orgId },
            orderBy: { name: "asc" },
            include: {
              _count: { select: { invoices: true } },
            },
          });
        } else {
          throw addrErr;
        }
      }
    } else {
      customers = await db.customer.findMany({
        where: { orgId },
        orderBy: { name: "asc" },
        include: {
          _count: { select: { invoices: true } },
        },
      });
    }
  } catch (err) {
    logServerError("CustomersPage", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button asChild>
          <Link href={`/${params.locale}/dashboard/customers/new`}>
            <Plus className="mr-2 h-4 w-4" /> {t("newCustomer")}
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCustomers")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("company")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("phone")}</TableHead>
                  <TableHead>{t("savedAddresses")}</TableHead>
                  <TableHead className="text-right">{t("invoices")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.company ?? "—"}</TableCell>
                    <TableCell>{c.email ?? "—"}</TableCell>
                    <TableCell>{c.phone ?? "—"}</TableCell>
                    <TableCell>
                      {(c as any).addresses?.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {(c as any).addresses.length}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">{c._count.invoices}</TableCell>
                    <TableCell className="text-right">
                      <form
                        action={async () => {
                          "use server";
                          await deleteCustomer(c.id);
                        }}
                      >
                        <Button type="submit" size="icon" variant="ghost">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
