import type { Metadata } from "next";
import Link from "next/link";

import { LoginBrandPanel } from "@/core/components/auth/login-brand-panel";
import { DrFlowLogo } from "@/core/components/brand/drflow-logo";

import { InvitationCredentialsLookupForm } from "@/features/auth/components/invitation-credentials-lookup-form";

export const metadata: Metadata = {
  title: "Credenciales de invitación",
  description: "Consultá el usuario y contraseña de acceso a DrFlow si te invitaron al consultorio.",
  robots: { index: false, follow: false },
};

export default function AccesoInvitadoPage() {
  return (
    <div className="flex min-h-screen">
      <LoginBrandPanel />
      <main
        id="main-content"
        className="flex flex-1 items-center justify-center bg-gradient-to-br from-blue-50/50 to-white p-6"
      >
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <DrFlowLogo size="lg" href="/" centered />
          </div>
          <InvitationCredentialsLookupForm />
          <p className="mt-6 text-center text-xs text-slate-500">
            <Link href="/login" className="hover:underline">
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
