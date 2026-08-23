import { requireUser, requireFeature, getActivePlan } from "@/lib/org";
import { hasFeature } from "@/lib/plans";
import { db } from "@/lib/db";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";
import { TimerBar } from "@/components/timer-bar";
import { TimeTrackerView } from "@/components/time-tracker-view";

export default async function TimeTrackingPage({ params }: { params: { locale: string } }) {
  await requireFeature("timeTracking");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];
  const plan = await getActivePlan(user);
  const canApprove = hasFeature(plan, "timeTracking");

  let projects: { id: string; name: string }[];
  let initialEntries: any[];
  try {
    projects = await db["project"]["findMany"]({
      where: { orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    initialEntries = await db["timeEntry"]["findMany"]({
      where: { orgId },
      orderBy: { startTime: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: {
          select: {
            id: true,
            name: true,
            customerId: true,
            customer: { select: { name: true } },
          },
        },
      },
    });
  } catch (err) {
    logServerError("TimeTrackingPage", err);
    projects = [];
    initialEntries = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Time Tracking</h1>
        <p className="text-sm text-muted-foreground">
          Track billable hours against projects and clients.
        </p>
      </div>
      <TimerBar projects={projects} />
      <TimeTrackerView initialEntries={initialEntries} canApprove={canApprove} userId={user["id"]} />
    </div>
  );
}
