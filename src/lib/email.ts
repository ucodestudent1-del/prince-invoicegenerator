import { logInfo, logError } from "@/lib/logging";

export interface EmailResult {
  success: boolean;
  status: "DELIVERED" | "QUEUED" | "SENT" | "FAILED";
  messageId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface EmailParams {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  metadata?: Record<string, string>;
}

export interface SendContext {
  invoice: {
    id: string;
    number: string;
    total: number;
    amountPaid: number;
    currency?: string;
    issueDate: Date | string;
    dueDate: Date | string | null;
    status: string;
  };
  customer: {
    name?: string | null;
    email?: string | null;
    company?: string | null;
  };
  organization: {
    name: string;
  };
  invoiceUrl?: string;
}

export function renderTemplate(template: string | null | undefined, ctx: SendContext): string {
  if (!template) return "";
  const balance = ctx.invoice.total - ctx.invoice.amountPaid;
  const daysOverdue = ctx.invoice.dueDate
    ? Math.max(0, Math.floor((Date.now() - new Date(ctx.invoice.dueDate).getTime()) / 86400000))
    : 0;

  const variables: Record<string, string> = {
    invoiceNumber: ctx.invoice.number,
    customerName: ctx.customer.name ?? ctx.customer.company ?? "Valued customer",
    companyName: ctx.organization.name,
    amount: formatCurrency(ctx.invoice.total, ctx.invoice.currency),
    balance: formatCurrency(balance, ctx.invoice.currency),
    dueDate: formatDate(ctx.invoice.dueDate),
    issueDate: formatDate(ctx.invoice.issueDate),
    daysOverdue: String(daysOverdue),
    invoiceUrl: ctx.invoiceUrl ?? "",
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

export function buildHtmlBody(bodyTemplate: string | null | undefined, ctx: SendContext): string {
  const plain = renderTemplate(bodyTemplate, ctx);
  if (!plain) return "";
  return plain.replace(/\n/g, "<br>");
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount || 0);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function sendEmail(params: EmailParams): Promise<EmailResult> {
  const provider = process.env.EMAIL_PROVIDER || "console";
  const from = params.from || process.env.FROM_EMAIL || "noreply@example.com";

  try {
    if (provider === "console" || provider === undefined) {
      logInfo("email", `[Console] To: ${params.to} | Subject: ${params.subject}`);
      if (process.env.NODE_ENV !== "production") {
        logInfo("email", `[Console] Body: ${params.text || params.html || ""}`);
      }
      return {
        success: true,
        status: "DELIVERED",
        messageId: `console-${Date.now()}`,
        metadata: { provider: "console" },
      };
    }

    if (provider === "resend") {
      const { Resend } = await dynamicImport("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from,
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        html: params.html || params.text,
        text: params.text,
        metadata: params.metadata,
      });
      if (result.error) {
        return {
          success: false,
          status: "FAILED",
          error: result.error.message,
        };
      }
      return {
        success: true,
        status: result.data?.id ? "QUEUED" : "SENT",
        messageId: result.data?.id,
        metadata: { provider: "resend" },
      };
    }

    if (provider === "smtp") {
      const nodemailer = await dynamicImport("nodemailer");
      const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      const info = await transporter.sendMail({
        from,
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      return {
        success: true,
        status: "SENT",
        messageId: info.messageId,
        metadata: { provider: "smtp", messageId: info.messageId },
      };
    }

    if (provider === "sendgrid") {
      const sgMail = await dynamicImport("@sendgrid/mail");
      sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
      const [result] = await sgMail.send({
        from,
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      return {
        success: true,
        status: "QUEUED",
        messageId: result?.headers?.["x-message-id"] as string,
        metadata: { provider: "sendgrid" },
      };
    }

    return {
      success: false,
      status: "FAILED",
      error: `Unknown EMAIL_PROVIDER: ${provider}`,
    };
  } catch (err: any) {
    logError("sendEmail", err);
    return {
      success: false,
      status: "FAILED",
      error: err?.message ?? "Email delivery failed",
    };
  }
}

async function dynamicImport(moduleName: string): Promise<any> {
  try {
    return await import(moduleName);
  } catch {
    throw new Error(
      `${moduleName} is not installed. Install it and set EMAIL_PROVIDER="${moduleName}" to enable email delivery.`
    );
  }
}

export function isEmailConfigured(): boolean {
  const provider = process.env.EMAIL_PROVIDER || "console";
  if (provider === "console" || provider === undefined) return true;

  if (provider === "resend") return !!process.env.RESEND_API_KEY;
  if (provider === "smtp") return !!process.env.SMTP_HOST && !!process.env.SMTP_USER;
  if (provider === "sendgrid") return !!process.env.SENDGRID_API_KEY;

  return false;
}
