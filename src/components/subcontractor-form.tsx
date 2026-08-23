"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { createSubcontractor } from "@/lib/actions/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SubcontractorForm() {
  const router = useRouter();
  const [error, setError] = React["useState"]<string | null>(null);
  const [saving, setSaving] = React["useState"](false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e["preventDefault"]();
    setSaving(true);
    setError(null);
    const fd = new FormData(e["currentTarget"]);
    try {
      await createSubcontractor({
        name: String(fd["get"]("name") || ""),
        company: String(fd["get"]("company") || "") || undefined,
        trade: String(fd["get"]("trade") || "") || undefined,
        email: String(fd["get"]("email") || "") || undefined,
        phone: String(fd["get"]("phone") || "") || undefined,
        rate: fd["get"]("rate") ? Number(fd["get"]("rate")) : undefined,
      });
      router["push"]("/dashboard/subcontractors");
      router["refresh"]();
    } catch (err: any) {
      setError(err?.["message"] ?? "Failed.");
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg">New subcontractor</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="company">Company</Label>
              <Input id="company" name="company" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="trade">Trade</Label>
              <Input id="trade" name="trade" placeholder="Electrical" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rate">Rate</Label>
              <Input id="rate" name="rate" type="number" step="0.01" min={0} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router["back"]()}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
