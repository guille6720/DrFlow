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
          <InvitationCredentialsViewPanel credentials={credentials} />
          <p className="mt-6 text-center text-xs text-slate-600">
            <Link
              href="/acceso-invitado"
              className="font-medium text-teal-700 underline-offset-2 hover:underline"
            >
              Buscar con otro email
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
