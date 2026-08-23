"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function LateFeeSettingsForm() {
  const [saving, setSaving] = React["useState"](false);
  const [loading, setLoading] = React["useState"](true);
  const [message, setMessage] = React["useState"]<string | null>(null);
  const [error, setError] = React["useState"]<string | null>(null);

  const [enabled, setEnabled] = React["useState"](false);
  const [rate, setRate] = React["useState"]("");
  const [graceDays, setGraceDays] = React["useState"]("0");
  const [fixedFee, setFixedFee] = React["useState"]("");
  const [maxFee, setMaxFee] = React["useState"]("");

  React["useEffect"](() => {
    async function load() {
      try {
        const res = await fetch("/api/late-fees/config");
        if (res["ok"]) {
          const data = await res["json"]();
          if (data) {
            setEnabled(data["enabled"]);
            setRate(String(data["rate"] || 0));
            setGraceDays(String(data["graceDays"] || 0));
            setFixedFee(String(data["fixedFee"] || 0));
            setMaxFee(data["maxFee"] ? String(data["maxFee"]) : "");
          }
        }
      } catch (err) {
        console["error"]("Failed to load late fee config", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e["preventDefault"]();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/late-fees/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON["stringify"]({
          enabled,
          rate: Number(rate) || 0,
          graceDays: Number(graceDays) || 0,
          fixedFee: Number(fixedFee) || 0,
          maxFee: maxFee ? Number(maxFee) : null,
        }),
      });
      if (!res["ok"]) {
        const data = await res["json"]();
        throw new Error(data["error"] || "Failed to save settings.");
      }
      setMessage("Settings saved successfully.");
    } catch (err: any) {
      setError(err["message"]);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading settings…</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Late fee settings</CardTitle>
        <CardDescription>
          Configure automatic late fee calculation for overdue invoices. Late fees
          are applied when an invoice remains unpaid past the grace period.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {message && (
            <div className="rounded-md border border-emerald-500/50 bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enabled">Enable late fees</Label>
              <p className="text-xs text-muted-foreground">
                Automatically calculate and apply late fees to overdue invoices.
              </p>
            </div>
            <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="rate">Late fee rate (%)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                value={rate}
                onChange={(e) => setRate(e["target"]["value"])}
                disabled={!enabled}
              />
              <p className="text-xs text-muted-foreground">
                Percentage of the outstanding balance charged as a late fee.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="graceDays">Grace period (days)</Label>
              <Input
                id="graceDays"
                type="number"
                min="0"
                max="30"
                value={graceDays}
                onChange={(e) => setGraceDays(e["target"]["value"])}
                disabled={!enabled}
              />
              <p className="text-xs text-muted-foreground">
                Days after the due date before late fees are applied.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="fixedFee">Fixed fee</Label>
              <Input
                id="fixedFee"
                type="number"
                step="0.01"
                min="0"
                value={fixedFee}
                onChange={(e) => setFixedFee(e["target"]["value"])}
                disabled={!enabled}
              />
              <p className="text-xs text-muted-foreground">
                Additional fixed fee added on top of the percentage.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="maxFee">Maximum late fee (optional)</Label>
              <Input
                id="maxFee"
                type="number"
                step="0.01"
                min="0"
                value={maxFee}
                onChange={(e) => setMaxFee(e["target"]["value"])}
                disabled={!enabled}
                placeholder="No cap"
              />
              <p className="text-xs text-muted-foreground">
                Cap on the total late fee amount.
              </p>
            </div>
          </div>

          <Button type="submit" disabled={saving || !enabled}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
