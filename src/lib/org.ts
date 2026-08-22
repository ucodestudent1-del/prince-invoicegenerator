import { logServerError } from "@/lib/errors";
import { ensureEnv } from "@/lib/env";
import { getServerSession } from "next-auth";
import { redirect } from "@/i18n/navigation";
import { getLocaleSafe } from "@/lib/locale";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { db, withRetry } from "@/lib/db";
import type { SubscriptionPlan } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { hasFeature, type FeatureKey } from "@/lib/plans";
import type { DefaultSession } from "next-auth";

// validateEnv() is intentionally NOT called here.
// Call ensureEnv() from server entry points (layout, API routes) instead.

export { ensureEnv };

type AppUser = DefaultSession["user"] & {
  id: string;
  organizationId: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
};

export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const session = await getServerSession(authOptions);
    return session?.user ?? null;
  } catch (err) {
    logServerError("getCurrentUser (session lookup)", err);
    return null;
  }
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    const locale = await getLocaleSafe();
    redirect({ href: "/login?error=session", locale });
    throw new Error("Unreachable: redirect should have exited");
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

    const onboarding = await db.onboardingState.findUnique({
      where: { userId },
    });

    if (!onboarding || !onboarding.isComplete) {
      return null;
    }

    const slug = `org-${userId}`;
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
    // If Organization columns are missing (schema drift), try fetching
    // the user with safe columns and use getCurrentOrg's fallback.
    if (isMissingColumnError(err)) {
      try {
        const user = await db.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            organizationId: true,
          },
        });
        if (!user) return null;
        if (user.organizationId) {
          // Use getCurrentOrg which has the column fallback
          return getCurrentOrg({ id: user.id } as AppUser);
        }
        // Can't create a new org — return null
        return null;
      } catch {
        return null;
      }
    }
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
    // If the Organization table has new columns from the latest schema
    // but migrations haven't been applied to the database, the standard
    // query will fail. Fall back to selecting only original columns and
    // provide default values for the newer fields.
     if (isMissingColumnError(err)) {
      try {
        const cookieTheme = cookies().get("theme")?.value;
        const org = await db.organization.findUnique({
          where: { id: orgId },
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            ownerId: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            stripePriceId: true,
            subscriptionStatus: true,
            currentPeriodEnd: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (!org) return null;
        return {
          ...org,
          template: "STANDARD" as const,
          theme: cookieTheme === "dark" || cookieTheme === "light" ? cookieTheme : "light",
          brandColor: null,
          accentColor: null,
          fontFamily: null,
          layout: "default",
        };
      } catch {
        return null;
      }
    }
    logServerError("getCurrentOrg", err);
    return null;
  }
}

// Detects Prisma errors where a database column is missing (schema drift).
export function isMissingColumnError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes("does not exist in the current database") ||
    msg.includes("column") && msg.includes("does not exist") ||
    msg.includes("42703") // PostgreSQL undefined_column error code
  );
}

// Detects Prisma errors where an enum value is missing from the database (schema drift).
export function isInvalidEnumValueError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes("invalid input value for enum") ||
    msg.includes("22P02") // PostgreSQL invalid_text_representation error code
  );
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
    if (!hasFeature(plan, feature)) {
      const locale = await getLocaleSafe();
      redirect({ href: "/pricing?upgrade=1", locale });
    }
  } catch (err) {
    logServerError("requireFeature", err);
    const locale = await getLocaleSafe();
    redirect({ href: "/login?error=session", locale });
  }
}
