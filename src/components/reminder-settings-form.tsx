"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ReminderSettingsForm() {
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [enabled, setEnabled] = React.useState(true);
  const [remindBeforeDue, setRemindBeforeDue] = React.useState("3");
  const [remindAfterDue, setRemindAfterDue] = React.useState("1");
  const [frequencyHours, setFrequencyHours] = React.useState("24");
  const [maxReminders, setMaxReminders] = React.useState("3");
  const [emailSubject, setEmailSubject] = React.useState(
    "Payment reminder for invoice {{invoiceNumber}}"
  );
  const [emailTemplate, setEmailTemplate] = React.useState(
    "Dear {{customerName}},\n\nThis is a reminder that invoice {{invoiceNumber}} for {{amount}} is due on {{dueDate}}.\n\nPlease arrange payment at your earliest convenience.\n\nThank you."
  );

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings/reminders");
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setEnabled(data.enabled);
            setRemindBeforeDue(String(data.remindBeforeDue));
            setRemindAfterDue(String(data.remindAfterDue));
            setFrequencyHours(String(data.frequencyHours));
            setMaxReminders(String(data.maxReminders));
            if (data.emailSubject) setEmailSubject(data.emailSubject);
            if (data.emailTemplate) setEmailTemplate(data.emailTemplate);
          }
        }
      } catch (err) {
        console.error("Failed to load reminder settings", err);
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          remindBeforeDue: Number(remindBeforeDue),
          remindAfterDue: Number(remindAfterDue),
          frequencyHours: Number(frequencyHours),
          maxReminders: Number(maxReminders),
          emailSubject,
          emailTemplate,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings.");
      }
      setMessage("Settings saved successfully.");
    } catch (err: any) {
      setError(err.message);
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
        <CardTitle className="text-lg">Reminder settings</CardTitle>
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
              <Label htmlFor="enabled">Enable automated reminders</Label>
              <p className="text-xs text-muted-foreground">
                Automatically send payment reminders for sent, viewed, and overdue invoices.
              </p>
            </div>
            <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="remindBeforeDue">Days before due date</Label>
              <Input
                id="remindBeforeDue"
                type="number"
                min="0"
                max="30"
                value={remindBeforeDue}
                onChange={(e) => setRemindBeforeDue(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="remindAfterDue">Days after due date</Label>
              <Input
                id="remindAfterDue"
                type="number"
                min="0"
                max="30"
                value={remindAfterDue}
                onChange={(e) => setRemindAfterDue(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="frequencyHours">Hours between reminders</Label>
              <Input
                id="frequencyHours"
                type="number"
                min="1"
                max="168"
                value={frequencyHours}
                onChange={(e) => setFrequencyHours(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="maxReminders">Max reminders per invoice</Label>
              <Input
                id="maxReminders"
                type="number"
                min="1"
                max="10"
                value={maxReminders}
                onChange={(e) => setMaxReminders(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="emailSubject">Email subject</Label>
            <Input
              id="emailSubject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Payment reminder for invoice {{invoiceNumber}}"
            />
            <p className="text-xs text-muted-foreground">
              Available variables: {"{{invoiceNumber}}"}, {"{{customerName}}"}, {"{{amount}}"}, {"{{dueDate}}"}, {"{{balance}}"}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="emailTemplate">Email template</Label>
            <Textarea
              id="emailTemplate"
              value={emailTemplate}
              onChange={(e) => setEmailTemplate(e.target.value)}
              rows={6}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
