import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Suspense } from "react";

import { LoginPageShell } from "@/core/components/auth/login-page-shell";

const LoginFormView = dynamic(
  () => import("@/core/components/auth/login-form-view").then((m) => m.LoginFormView),
  { loading: () => <LoginPageShell /> }
);

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Accedé a tu consultorio DrFlow: agenda, pacientes, historia clínica y recetas.",
  alternates: { canonical: "/login" },
  robots: { index: true, follow: true },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageShell />}>
      <LoginFormView />
    </Suspense>
  );
}
