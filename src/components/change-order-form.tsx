"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createChangeOrder } from "@/lib/actions/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ChangeOrderForm({
  projects,
  invoices,
}: {
  projects: { id: string; name: string }[];
  invoices: { id: string; number: string }[];
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await createChangeOrder({
        title: String(fd.get("title") || ""),
        description: String(fd.get("description") || "") || undefined,
        projectId: String(fd.get("projectId") || "") || null,
        invoiceId: String(fd.get("invoiceId") || "") || null,
        amount: Number(fd.get("amount") || 0),
      });
      router.push("/dashboard/change-orders");
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Failed.");
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg">New change order</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="projectId">Project</Label>
              <select id="projectId" name="projectId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="invoiceId">Linked invoice</Label>
              <select id="invoiceId" name="invoiceId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">None</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>{i.number}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" name="amount" type="number" step="0.01" min={0} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
