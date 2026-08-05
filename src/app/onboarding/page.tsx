import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getProfile, getUserClinics } from "@/core/auth/session";
import { parseTrialDays, TRIAL_REGISTRATION_COOKIE } from "@/core/trial/clinic-trial";

import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const clinics = await getUserClinics();
  if (clinics.length > 0) redirect("/dashboard");

  const cookieStore = await cookies();
  const trialDays = parseTrialDays(cookieStore.get(TRIAL_REGISTRATION_COOKIE)?.value);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <OnboardingForm
        userEmail={profile.email}
        userName={profile.full_name ?? undefined}
        trialDays={trialDays ?? undefined}
      />
    </div>
  );
}
