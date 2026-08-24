import { Link } from "@/i18n/navigation";
import { requireUser, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Filter, DollarSign, FileText, Archive } from "lucide-react";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";
import { formatCurrency } from "@/lib/utils";
import { CustomersSearch } from "@/components/customers-search";

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { q?: string; status?: string };
}) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];
  const t = await getTranslations("customers");

  const searchQuery = searchParams["q"] || "";
  const statusFilter = searchParams["status"] || "ACTIVE";

  let customers: any;
  try {
    const where: Record<string, any> = { orgId };
    if (searchQuery) {
      where["OR"] = [
        { name: { contains: searchQuery, mode: "insensitive" } },
        { company: { contains: searchQuery, mode: "insensitive" } },
        { email: { contains: searchQuery, mode: "insensitive" } },
      ];
    }
    if (statusFilter && statusFilter !== "ALL") {
      where["status"] = statusFilter;
    }

    customers = await db.customer.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        phone: true,
        status: true,
        outstandingBalance: true,
        totalInvoiced: true,
        totalPaid: true,
        createdAt: true,
        _count: { select: { invoices: true } },
      },
    });
   } catch (err) {
    if (isMissingColumnError(err)) {
      const where: Record<string, any> = { orgId };
      if (searchQuery) {
        where["OR"] = [
          { name: { contains: searchQuery, mode: "insensitive" } },
          { company: { contains: searchQuery, mode: "insensitive" } },
          { email: { contains: searchQuery, mode: "insensitive" } },
        ];
      }
      customers = await db.customer.findMany({
        where,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          company: true,
          email: true,
          phone: true,
          createdAt: true,
          _count: { select: { invoices: true } },
        },
      }) as any;
    } else {
      logServerError("CustomersPage", err);
      throw err;
    }
  }

  // Calculate summary stats
  const totalOutstanding = customers.reduce((sum: number, c: any) => sum + (c.outstandingBalance || 0), 0);
  const totalInvoiced = customers.reduce((sum: number, c: any) => sum + (c.totalInvoiced || 0), 0);
  const activeCustomers = customers.filter((c: any) => (c["status"] || "ACTIVE") === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {activeCustomers} active clients • {formatCurrency(totalOutstanding)} outstanding
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/customers/new">
            <Plus className="mr-2 h-4 w-4" /> {t("newCustomer")}
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalInvoiced)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalOutstanding)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCustomers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <CustomersSearch initialQuery={searchQuery} initialStatus={statusFilter} />

      {/* Customers Table */}
      <Card>
        <CardContent className="pt-6">
          {customers["length"] === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t("noCustomers")}</p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/dashboard/customers/new">Add your first client</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead className="text-right">Total Invoiced</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">{t("invoices")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/customers/${c.id}`} className="hover:underline">
                        {c.name}
                      </Link>
                      {c.company && (
                        <p className="text-xs text-muted-foreground">{c.company}</p>
                      )}
                    </TableCell>
                    <TableCell>{c["email"] ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c["totalInvoiced"] || 0)}</TableCell>
                    <TableCell className="text-right">
                      <span className={c["outstandingBalance"] > 0 ? "text-orange-600 font-medium" : ""}>
                        {formatCurrency(c["outstandingBalance"] || 0)}
                      </span>
                    </TableCell>
                     <TableCell>
                       <span
                         className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                           (c["status"] || "ACTIVE") === "ACTIVE"
                             ? "bg-green-100 text-green-700"
                             : (c["status"] || "ACTIVE") === "ARCHIVED"
                             ? "bg-gray-100 text-gray-700"
                             : "bg-red-100 text-red-700"
                         }`}
                       >
                         {c["status"] || "ACTIVE"}
                       </span>
                     </TableCell>
                    <TableCell className="text-right">{c["_count"]["invoices"]}</TableCell>
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
