import { redirect } from "next/navigation";
import { getProfile, getUserClinics } from "@/lib/auth/session";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const clinics = await getUserClinics();
  if (clinics.length > 0) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <OnboardingForm userEmail={profile.email} userName={profile.full_name ?? undefined} />
    </div>
  );
}
