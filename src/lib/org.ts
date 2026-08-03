import { logServerError, validateEnv } from "@/lib/errors";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db, withRetry } from "@/lib/db";
import type { SubscriptionPlan } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { hasFeature, type FeatureKey } from "@/lib/plans";
import type { DefaultSession } from "next-auth";

validateEnv();

type AppUser = DefaultSession["user"] & {
  id: string;
  organizationId: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
};

export async function getCurrentUser() {
  try {
    const session = await getServerSession(authOptions);
    return session?.user ?? null;
  } catch (err) {
    logServerError("getCurrentUser (session lookup)", err);
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?error=session");
  }
  return user;
}

// Each user belongs to an Organization. Owners get one auto-created on first use.
export async function ensureOrganization(userId: string) {
  try {
    const user = await withRetry(() =>
      db.user.findUnique({
        where: { id: userId },
        include: { organization: true },
      })
    );
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
  } catch (err) {
    logServerError("ensureOrganization", err);
    return null;
  }
}

export async function getCurrentOrg(user?: AppUser) {
  const currentUser = user ?? (await getCurrentUser());
  const orgId = currentUser?.organizationId;
  if (!orgId) return null;
  try {
    return await withRetry(() =>
      db.organization.findUnique({ where: { id: orgId } })
    );
  } catch (err) {
    logServerError("getCurrentOrg", err);
    return null;
  }
}

export async function getActivePlan(user?: AppUser): Promise<SubscriptionPlan> {
  const org = await getCurrentOrg(user);
  return org?.plan ?? "FREE";
}

// Gate a feature behind the active subscription plan. Redirects to /pricing#upgrade.
export async function requireFeature(feature: FeatureKey) {
  const user = await requireUser();
  const orgId = user.organizationId;
  if (!orgId) return;
  try {
    const org = await withRetry(() =>
      db.organization.findUnique({
        where: { id: orgId },
        select: { plan: true },
      })
    );
    const plan = org?.plan ?? "FREE";
    if (!hasFeature(plan, feature)) redirect("/pricing?upgrade=1");
  } catch (err) {
    logServerError("requireFeature", err);
    redirect("/login?error=session");
  }
}
