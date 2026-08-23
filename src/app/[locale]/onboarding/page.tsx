import { requireUser } from "@/lib/org";
import { getOnboardingState } from "@/lib/actions/onboarding";
import { getAutoDetectedSettings } from "@/lib/geo";
import OnboardingForm from "@/components/onboarding-form";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getLocaleSafe } from "@/lib/locale";

export default async function OnboardingPage() {
  await requireUser();

  const state = await getOnboardingState();
  const t = await getTranslations("onboarding");

  if (!state["shouldOnboard"]) {
    redirect({ href: "/dashboard", locale: await getLocaleSafe() });
  }

  const headersList = await headers();
  const forwardedFor = headersList["get"]("x-forwarded-for");
  const ipAddress = forwardedFor?.["split"](",")[0]?.["trim"]() || null;

  const autoDetected = getAutoDetectedSettings(ipAddress || undefined);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <OnboardingForm
        initialData={{
          identity: state["identityData"] as any,
          contact: state["contactData"] as any,
          compliance: state["complianceData"] as any,
          currentStep: state["currentStep"] as any,
          autoDetected,
        }}
      />
    </div>
  );
}
