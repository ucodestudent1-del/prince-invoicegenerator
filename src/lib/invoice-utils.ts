import type { ReminderStageType } from "@prisma/client";

export interface DefaultStageTemplate {
  name: string;
  type: "PRE_DUE" | "DUE_DATE" | "POST_DUE";
  daysOffset: number;
  subjectTemplate: string;
  bodyTemplate: string;
}

export function buildDefaultStages(config: any): DefaultStageTemplate[] {
  const before = config?.remindBeforeDue ?? 7;
  const after = config?.remindAfterDue ?? 1;
  const subject = config?.emailSubject ?? "Payment reminder for invoice {{invoiceNumber}}";
  const template = config?.emailTemplate ??
    "Dear {{customerName}},\n\nThis is a reminder that invoice {{invoiceNumber}} for {{amount}} is due on {{dueDate}}.\n\nPlease arrange payment at your earliest convenience.\n\nThank you.";

  return [
    {
      name: "Friendly reminder",
      type: "PRE_DUE",
      daysOffset: -before,
      subjectTemplate: subject,
      bodyTemplate: template,
    },
    {
      name: "Due date reminder",
      type: "DUE_DATE",
      daysOffset: 0,
      subjectTemplate: subject,
      bodyTemplate: template,
    },
    {
      name: "Overdue notice",
      type: "POST_DUE",
      daysOffset: after,
      subjectTemplate: subject,
      bodyTemplate: template,
    },
  ];
}
