import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LoginBrandPanel } from "@/core/components/auth/login-brand-panel";
import { DrFlowLogo } from "@/core/components/brand/drflow-logo";

import { InvitationCredentialsViewPanel } from "@/features/auth/components/invitation-credentials-view";

import { loadInvitationCredentialsById } from "@/lib/server/invitation-credentials";

export const metadata: Metadata = {
  title: "Tus credenciales de acceso",
  robots: { index: false, follow: false },
};

export default async function AccesoInvitadoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const credentials = await loadInvitationCredentialsById(id);
  if (!credentials) notFound();

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
          <InvitationCredentialsViewPanel credentials={credentials} />
          <p className="mt-6 text-center text-xs text-slate-500">
            <Link href="/acceso-invitado" className="hover:underline">
              Buscar con otro email
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
