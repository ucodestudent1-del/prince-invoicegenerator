import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SubscriptionPlan } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { hasFeature, type FeatureKey } from "@/lib/plans";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Each user belongs to an Organization. Owners get one auto-created on first use.
export async function ensureOrganization(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });
  if (!user) return null;
  if (user.organizationId && user.organization) return user.organization;

  const slug = `org-${userId.slice(0, 8)}`;
  try {
    const org = await db.organization.create({
      data: {
        name: `${user.name ?? "My"} Contracting`,
        slug,
        ownerId: userId,
      },
    });
    await db.user.update({
      where: { id: userId },
      data: { organizationId: org.id },
    });
    return org;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const org = await db.organization.findUnique({ where: { slug } });
      if (org) {
        await db.user.update({
          where: { id: userId },
          data: { organizationId: org.id },
        });
        return org;
      }
    }
    throw err;
  }
}

export async function getCurrentOrg() {
  const user = await requireUser();
  if (!user.organizationId) return null;
  return db.organization.findUnique({ where: { id: user.organizationId } });
}

export async function getActivePlan(): Promise<SubscriptionPlan> {
  const org = await getCurrentOrg();
  return org?.plan ?? "FREE";
}

// Gate a feature behind the active subscription plan. Redirects to /pricing#upgrade.
export async function requireFeature(feature: FeatureKey) {
  const user = await requireUser();
  if (!user.organizationId) return;
  const org = await db.organization.findUnique({
    where: { id: user.organizationId },
    select: { plan: true },
  });
  const plan = org?.plan ?? "FREE";
  if (!hasFeature(plan, feature)) redirect("/pricing?upgrade=1");
}
