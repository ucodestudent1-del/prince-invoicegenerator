import Link from "next/link";
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

export default async function CustomersPage() {
  const user = await requireUser();
  if (!user.organizationId) return null;
  const orgId = user.organizationId;

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
        // CustomerAddress table may not exist yet — fall back without addresses
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
        <h1 className="text-2xl font-bold">Customers</h1>
        <Button asChild>
          <Link href="/dashboard/customers/new">
            <Plus className="mr-2 h-4 w-4" /> New customer
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customers yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Saved addresses</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
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
