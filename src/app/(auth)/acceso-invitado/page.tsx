import type { Metadata } from "next";
import Link from "next/link";

import { LoginBrandPanel } from "@/core/components/auth/login-brand-panel";
import { DrFlowLogo } from "@/core/components/brand/drflow-logo";

import { InvitationCredentialsLookupForm } from "@/features/auth/components/invitation-credentials-lookup-form";

export const metadata: Metadata = {
  title: "Credenciales de invitación",
  description: "Consultá el usuario y contraseña de acceso a NexClinic si te invitaron al consultorio.",
  robots: { index: false, follow: false },
};

export default function AccesoInvitadoPage() {
  return (
    <div className="drflow-auth-page flex min-h-[100dvh]">
      <LoginBrandPanel />
      <main
        id="main-content"
        className="flex flex-1 items-center justify-center bg-[#eef2f6] px-4 py-10 sm:px-6"
      >
        <div className="drflow-auth-surface w-full max-w-[420px] rounded-2xl border border-slate-200/80 p-6 shadow-[0_18px_50px_-24px_rgb(15_23_42_/_0.35)] sm:p-8">
          <div className="mb-6 flex justify-center">
            <DrFlowLogo size="lg" href="/" centered withTagline />
          </div>
          <InvitationCredentialsLookupForm />
          <p className="mt-6 text-center text-xs text-slate-600">
            <Link href="/login" className="font-medium text-teal-700 underline-offset-2 hover:underline">
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
