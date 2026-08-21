"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Plus, Trash2, Mail, Bell, BellOff, Copy } from "lucide-react";

interface Stage {
  id?: string;
  name: string;
  type: "PRE_DUE" | "DUE_DATE" | "POST_DUE";
  enabled: boolean;
  daysOffset: number;
  timeOfDay?: string | null;
  subjectTemplate?: string | null;
  bodyTemplate?: string | null;
  channel?: string;
}

interface Config {
  enabled: boolean;
  frequencyHours: number;
  maxReminders: number;
  remindBeforeDue?: number;
  remindAfterDue?: number;
  emailSubject?: string | null;
  emailTemplate?: string | null;
  stages: Stage[];
}

const TEMPLATE_VARIABLES = [
  "{{invoiceNumber}}",
  "{{customerName}}",
  "{{companyName}}",
  "{{amount}}",
  "{{balance}}",
  "{{dueDate}}",
  "{{issueDate}}",
  "{{daysOverdue}}",
  "{{invoiceUrl}}",
];

const DEFAULT_SUBJECTS: Record<string, string> = {
  PRE_DUE: "Friendly reminder: Invoice {{invoiceNumber}} due on {{dueDate}}",
  DUE_DATE: "Invoice {{invoiceNumber}} is due today",
  POST_DUE: "Invoice {{invoiceNumber}} is now overdue",
};

const DEFAULT_BODIES: Record<string, string> = {
  PRE_DUE: "Dear {{customerName}},\n\nThis is a friendly heads-up that invoice {{invoiceNumber}} for {{amount}} is due on {{dueDate}}.\n\nIf you've already sent payment, thank you. Otherwise, please arrange payment at your earliest convenience.\n\nPay online: {{invoiceUrl}}\n\nThank you,\n{{companyName}}",
  DUE_DATE: "Dear {{customerName}},\n\nThis is a courtesy reminder that invoice {{invoiceNumber}} for {{amount}} was due today ({{dueDate}}).\n\nPlease arrange payment as soon as possible to avoid any late fees.\n\nPay online: {{invoiceUrl}}\n\nThank you,\n{{companyName}}",
  POST_DUE: "Dear {{customerName}},\n\nInvoice {{invoiceNumber}} for {{balance}} is now overdue (originally due {{dueDate}}).\n\nPlease settle this invoice immediately. A late fee may have been applied.\n\nPay online: {{invoiceUrl}}\n\nThank you,\n{{companyName}}",
};

const DEFAULT_STAGES: Stage[] = [
  {
    name: "Friendly reminder (7 days before)",
    type: "PRE_DUE" as const,
    enabled: true,
    daysOffset: -7,
    subjectTemplate: DEFAULT_SUBJECTS.PRE_DUE,
    bodyTemplate: DEFAULT_BODIES.PRE_DUE,
    channel: "EMAIL",
  },
  {
    name: "Due date notification",
    type: "DUE_DATE" as const,
    enabled: true,
    daysOffset: 0,
    subjectTemplate: DEFAULT_SUBJECTS.DUE_DATE,
    bodyTemplate: DEFAULT_BODIES.DUE_DATE,
    channel: "EMAIL",
  },
  {
    name: "1 day overdue",
    type: "POST_DUE" as const,
    enabled: true,
    daysOffset: 1,
    subjectTemplate: DEFAULT_SUBJECTS.POST_DUE.replace("overdue", "is 1 day overdue"),
    bodyTemplate: DEFAULT_BODIES.POST_DUE,
    channel: "EMAIL",
  },
  {
    name: "7 days overdue",
    type: "POST_DUE" as const,
    enabled: true,
    daysOffset: 7,
    subjectTemplate: "Invoice {{invoiceNumber}} is 7 days overdue",
    bodyTemplate: DEFAULT_BODIES.POST_DUE,
    channel: "EMAIL",
  },
  {
    name: "14 days overdue",
    type: "POST_DUE" as const,
    enabled: true,
    daysOffset: 14,
    subjectTemplate: "URGENT: Invoice {{invoiceNumber}} is 14 days overdue",
    bodyTemplate: DEFAULT_BODIES.POST_DUE,
    channel: "EMAIL",
  },
  {
    name: "30 days overdue (final notice)",
    type: "POST_DUE" as const,
    enabled: true,
    daysOffset: 30,
    subjectTemplate: "FINAL NOTICE: Invoice {{invoiceNumber}} is 30 days overdue",
    bodyTemplate: DEFAULT_BODIES.POST_DUE,
    channel: "EMAIL",
  },
];

const STAGE_LABELS = {
  PRE_DUE: { label: "Before due", icon: Bell, color: "bg-blue-500/10 text-blue-700" },
  DUE_DATE: { label: "Due date", icon: Bell, color: "bg-amber-500/10 text-amber-700" },
  POST_DUE: { label: "Overdue", icon: BellOff, color: "bg-red-500/10 text-red-700" },
};

export function ReminderSettingsForm() {
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [config, setConfig] = React.useState<Config>({
    enabled: true,
    frequencyHours: 24,
    maxReminders: 5,
    stages: DEFAULT_STAGES,
  });

  const [editingStageId, setEditingStageId] = React.useState<string | null>(null);
  const [expandedStageId, setExpandedStageId] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings/reminders");
        if (res.ok) {
          const data = await res.json();
          if (data) {
            const normalizedStages = (data.stages?.length > 0 ? data.stages : DEFAULT_STAGES).map(
              (s: any) => ({
                ...s,
                type: s.type as "PRE_DUE" | "DUE_DATE" | "POST_DUE",
                daysOffset: s.daysOffset ?? 0,
              })
            );
            setConfig({
              enabled: data.enabled,
              frequencyHours: data.frequencyHours ?? 24,
              maxReminders: data.maxReminders ?? 5,
              remindBeforeDue: data.remindBeforeDue,
              remindAfterDue: data.remindAfterDue,
              emailSubject: data.emailSubject,
              emailTemplate: data.emailTemplate,
              stages: normalizedStages,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load reminder settings", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function updateStage(id: string, updates: Partial<Stage>) {
    setConfig((prev) => ({
      ...prev,
      stages: prev.stages.map((s) =>
        s.id === id || (!s.id && editingStageId === id) ? { ...s, ...updates } : s
      ),
    }));
  }

  function addStage(stage: Stage) {
    const newStage = { ...stage, id: `new-${Date.now()}` };
    setConfig((prev) => ({
      ...prev,
      stages: [...prev.stages, newStage],
    }));
    setEditingStageId(newStage.id);
  }

  function removeStage(id: string) {
    setConfig((prev) => ({
      ...prev,
      stages: prev.stages.filter((s) => s.id !== id && `new-${id}` !== id),
    }));
    if (editingStageId === id) setEditingStageId(null);
    if (expandedStageId === id) setExpandedStageId(null);
  }

  function toggleStage(id: string, enabled: boolean) {
    setConfig((prev) => ({
      ...prev,
      stages: prev.stages.map((s) =>
        s.id === id || (`new-${id}` === id && !s.id) ? { ...s, enabled } : s
      ),
    }));
  }

  const getSubjectPreview = (stage: Stage) => {
    return (stage.subjectTemplate || DEFAULT_SUBJECTS[stage.type] || "")
      .replace(/\{\{invoiceNumber\}\}/g, "INV-0042")
      .replace(/\{\{customerName\}\}/g, "Acme Corp")
      .replace(/\{\{companyName\}\}/g, config.stages ? "Your Company" : "Your Company")
      .replace(/\{\{amount\}\}/g, "$1,250.00")
      .replace(/\{\{balance\}\}/g, "$1,250.00")
      .replace(/\{\{dueDate\}\}/g, "Aug 20, 2026")
      .replace(/\{\{issueDate\}\}/g, "Aug 1, 2026")
      .replace(/\{\{daysOverdue\}\}/g, "3")
      .replace(/\{\{invoiceUrl\}\}/g, "https://app.example.com/invoice/INV-0042");
  };

  const getEditor = (stage: Stage) => {
    const stageInfo = STAGE_LABELS[stage.type];
    const Icon = stageInfo.icon;

    return (
      <div key={stage.id || `new-${stage.name}`} className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={stageInfo.color}>
              <Icon className="h-3 w-3 mr-1" />
              {stageInfo.label}
            </Badge>
            <span className="font-medium">{stage.name}</span>
          </div>
          <Switch
            checked={stage.enabled}
            onCheckedChange={(v) => toggleStage(stage.id || "", v)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Stage name</Label>
            <Input
              value={stage.name}
              onChange={(e) => updateStage(stage.id || "", { name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Days relative to due date</Label>
            <Input
              type="number"
              value={stage.daysOffset}
              onChange={(e) =>
                updateStage(stage.id || "", { daysOffset: parseInt(e.target.value, 10) || 0 })
              }
              disabled={!stage.enabled}
            />
            <p className="text-xs text-muted-foreground">
              Negative = before due, 0 = on due date, positive = after due
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Time of day (optional)</Label>
            <Input
              type="time"
              value={stage.timeOfDay || ""}
              onChange={(e) => updateStage(stage.id || "", { timeOfDay: e.target.value || null })}
              disabled={!stage.enabled}
            />
          </div>
          <div className="space-y-1">
            <Label>Channel</Label>
            <Input
              value={stage.channel || "EMAIL"}
              disabled
              className="bg-muted"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Email subject</Label>
          <Input
            value={stage.subjectTemplate || ""}
            onChange={(e) =>
              updateStage(stage.id || "", { subjectTemplate: e.target.value })
            }
            disabled={!stage.enabled}
            placeholder={DEFAULT_SUBJECTS[stage.type]}
          />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Available variables: {TEMPLATE_VARIABLES.join(", ")}</p>
            <p className="font-medium">Preview:</p>
            <p className="text-xs break-all bg-muted/50 p-2 rounded">
              {getSubjectPreview(stage) || "(empty subject)"}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <Label>Email body</Label>
          <Textarea
            value={stage.bodyTemplate || ""}
            onChange={(e) =>
              updateStage(stage.id || "", { bodyTemplate: e.target.value })
            }
            disabled={!stage.enabled}
            rows={6}
            placeholder={DEFAULT_BODIES[stage.type]}
          />
          <p className="text-xs text-muted-foreground">
            Use variables: {TEMPLATE_VARIABLES.join(", ")}
          </p>
        </div>
      </div>
    );
  };

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
          enabled: config.enabled,
          frequencyHours: config.frequencyHours,
          maxReminders: config.maxReminders,
          remindBeforeDue: config.remindBeforeDue,
          remindAfterDue: config.remindAfterDue,
          emailSubject: config.emailSubject,
          emailTemplate: config.emailTemplate,
          stages: config.stages,
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

  function getTriggerDescription(stage: Stage): string {
    if (stage.type === "PRE_DUE") {
      return `${Math.abs(stage.daysOffset)} day(s) before due date`;
    }
    if (stage.type === "DUE_DATE") {
      return "On the due date";
    }
    return `${stage.daysOffset} day(s) after due date`;
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading settings…</p>;
  }

  return (
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Automated reminders</CardTitle>
          <CardDescription>
            Configure automatic payment reminders sent at key points before, on,
            and after each invoice due date. Each stage can have its own email
            template with escalating tone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <Label htmlFor="enabled">Enable automated reminders</Label>
              <p className="text-xs text-muted-foreground">
                When disabled, no reminders will be sent. Configuration is preserved.
              </p>
            </div>
            <Switch
              id="enabled"
              checked={config.enabled}
              onCheckedChange={(v) => setConfig((prev) => ({ ...prev, enabled: v }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="frequencyHours">Hours between reminders</Label>
              <Input
                id="frequencyHours"
                type="number"
                min="1"
                max="168"
                value={String(config.frequencyHours)}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, frequencyHours: Number(e.target.value) || 24 }))
                }
                disabled={!config.enabled}
              />
              <p className="text-xs text-muted-foreground">
                Minimum hours between reminders for the same invoice.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="maxReminders">Max reminders per invoice</Label>
              <Input
                id="maxReminders"
                type="number"
                min="1"
                max="20"
                value={String(config.maxReminders)}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, maxReminders: Number(e.target.value) || 5 }))
                }
                disabled={!config.enabled}
              />
              <p className="text-xs text-muted-foreground">
                Maximum total reminders sent per invoice across all stages.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reminder stages</CardTitle>
          <CardDescription>
            Customize the timing, tone, and email content for each stage of the
            escalation sequence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.stages.map((stage) => {
            const stageInfo = STAGE_LABELS[stage.type];
            const Icon = stageInfo.icon;
            const isExpanded = expandedStageId === (stage.id || "");

            return (
              <div key={stage.id || `stage-${stage.name}`} className="border rounded-lg">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() =>
                    setExpandedStageId(isExpanded ? null : stage.id || "")
                  }
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={stageInfo.color}>
                      <Icon className="h-3 w-3 mr-1" />
                      {stageInfo.label}
                    </Badge>
                    <div>
                      <span className="font-medium">{stage.name}</span>
                      <p className="text-sm text-muted-foreground">
                        {getTriggerDescription(stage)}
                      </p>
                    </div>
                    {!stage.enabled && (
                      <Badge variant="secondary" className="ml-2">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStage(stage.id || "");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4">{getEditor(stage)}</div>
                )}
              </div>
            );
          })}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                addStage({
                  name: "Custom reminder",
                  type: "POST_DUE",
                  enabled: true,
                  daysOffset: 3,
                  subjectTemplate: DEFAULT_SUBJECTS.POST_DUE,
                  bodyTemplate: DEFAULT_BODIES.POST_DUE,
                  channel: "EMAIL",
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add stage
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Template variables</CardTitle>
          <CardDescription>
            Use these variables in your subject and body templates. They are
            replaced with invoice-specific data when the email is sent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_VARIABLES.map((v) => (
              <Badge key={v} variant="secondary" className="font-mono">
                {v}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving || !config.enabled}>
        {saving ? "Saving…" : "Save all settings"}
      </Button>
    </form>
  );
}
