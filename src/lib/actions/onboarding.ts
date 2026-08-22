"use server";

import { withActionError, actionError } from "@/lib/action-errors";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";

export type OnboardingStep = "identity" | "contact" | "compliance" | "review";

export interface IdentityData {
  businessName: string;
  logoUrl?: string;
  industry?: string;
  businessType?: string;
  registrationNumber?: string;
  website?: string;
}

export interface ContactData {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  email: string;
}

export interface ComplianceData {
  taxId?: string;
  taxIdType?: string;
  currency: string;
  language: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  defaultTaxRate: number;
  defaultPaymentTerms: string;
}

export async function getOnboardingState() {
  return withActionError("getOnboardingState", async () => {
    const user = await requireUser();

    const state = await db.onboardingState.findUnique({
      where: { userId: user.id },
    });

    if (state?.isComplete) {
      return { shouldOnboard: false };
    }

    const hasOrg = !!(user as any).organizationId;
    if (hasOrg && !state) {
      return { shouldOnboard: false };
    }

    return {
      shouldOnboard: true,
      currentStep: state?.currentStep || "identity",
      completedSteps: state?.completedSteps || [],
      identityData: (state?.identityData as IdentityData | null) || null,
      contactData: (state?.contactData as ContactData | null) || null,
      complianceData: (state?.complianceData as ComplianceData | null) || null,
    };
  });
}

export async function saveOnboardingStep(step: OnboardingStep, data: Record<string, any>) {
  return withActionError("saveOnboardingStep", async () => {
    const user = await requireUser();

    const state = await db.onboardingState.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        currentStep: step,
        completedSteps: [step],
        [step === "identity" ? "identityData" : step === "contact" ? "contactData" : "complianceData"]: data,
      },
      update: {
        currentStep: step,
        lastActiveAt: new Date(),
        [step === "identity" ? "identityData" : step === "contact" ? "contactData" : "complianceData"]: data,
      },
    });

    const completedSteps = Array.from(new Set([...state.completedSteps, step]));

    await db.onboardingState.update({
      where: { userId: user.id },
      data: { completedSteps },
    });

    return { success: true, completedSteps };
  });
}

export async function completeOnboarding() {
  return withActionError("completeOnboarding", async () => {
    const user = await requireUser();

    const state = await db.onboardingState.findUnique({
      where: { userId: user.id },
    });

    if (!state) {
      actionError("Onboarding state not found.");
    }

    if (state.isComplete) {
      return { success: true };
    }

    const identity = state.identityData as IdentityData | null;
    const contact = state.contactData as ContactData | null;
    const compliance = state.complianceData as ComplianceData | null;

    if (!identity?.businessName) {
      actionError("Business name is required.");
    }

    const slug = await generateUniqueSlug(identity.businessName, user.id);

    let org;
    try {
      org = await db.organization.create({
        data: {
          name: identity.businessName,
          slug,
          ownerId: user.id,
          logoUrl: identity.logoUrl,
          industry: identity.industry,
          businessType: identity.businessType,
          registrationNumber: identity.registrationNumber,
          website: identity.website,
          addressLine1: contact?.addressLine1,
          addressLine2: contact?.addressLine2,
          city: contact?.city,
          state: contact?.state,
          postalCode: contact?.postalCode,
          country: contact?.country || "US",
          phone: contact?.phone,
          email: contact?.email,
          taxId: compliance?.taxId,
          taxIdType: compliance?.taxIdType,
          currency: compliance?.currency || "USD",
          language: compliance?.language || "en",
          timezone: compliance?.timezone || "America/New_York",
          dateFormat: compliance?.dateFormat || "MM/DD/YYYY",
          numberFormat: compliance?.numberFormat || "en-US",
          defaultTaxRate: compliance?.defaultTaxRate ?? 0,
          defaultPaymentTerms: compliance?.defaultPaymentTerms || "NET_30",
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        actionError("You already have an organization. Please contact support if you need to create another one.");
      }
      throw err;
    }

    await db.user.update({
      where: { id: user.id },
      data: { organizationId: org.id },
    });

    await createInvoiceProfile(org.id);

    await db.onboardingState.update({
      where: { userId: user.id },
      data: { isComplete: true, completedAt: new Date() },
    });

    return { success: true, organizationId: org.id };
  });
}

async function generateUniqueSlug(businessName: string, userId: string): Promise<string> {
  const baseSlug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

  const withUser = `${baseSlug}-${userId.slice(0, 8)}`;

  let slug = withUser;
  let counter = 1;

  while (true) {
    const existing = await db.organization.findUnique({ where: { slug } });
    if (!existing) return slug;
    slug = `${withUser}-${counter}`;
    counter++;
  }
}

async function createInvoiceProfile(orgId: string) {
  const org = await db.organization.findUnique({
    where: { id: orgId },
  });

  if (!org) return;

  const template = await db.invoiceTemplate.create({
    data: {
      orgId,
      name: "Default Template",
      baseTemplate: "professional",
      isDefault: true,
      logoUrl: org.logoUrl,
      primaryColor: "#1e40af",
      showCompanyName: true,
      showCompanyAddress: true,
      showCompanyPhone: !!org.phone,
      showCompanyEmail: !!org.email,
      showTaxId: !!org.taxId,
      showPaymentInfo: true,
    },
  });

  await db.organizationSettings.create({
    data: {
      orgId,
      defaultTemplateId: template.id,
      emailSubjectTemplate: `Invoice {{invoiceNumber}} from {{companyName}}`,
      emailBodyTemplate: `Dear {{customerName}},\n\nPlease find attached invoice {{invoiceNumber}} for {{amount}}.\n\nPayment is due by {{dueDate}}.\n\nThank you for your business.\n\n{{companyName}}`,
      autoReminders: false,
    },
  });

  await db.paymentInfo.create({
    data: {
      orgId,
      showOnInvoice: true,
      paymentInstructions: `Payment is due within ${org.defaultPaymentTerms.replace("NET_", "")} days.`,
    },
  });
}
