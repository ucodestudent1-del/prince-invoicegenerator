import Link from "next/link";
import { requireUser } from "@/lib/org";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerForm } from "@/components/customer-form";
import { Plus } from "lucide-react";

export default async function NewCustomerPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New customer</h1>
      <CustomerForm />
    </div>
  );
}
