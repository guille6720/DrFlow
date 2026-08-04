"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { RestablecerPasswordFormView } from "@/core/components/auth/restablecer-password-form-view";

export default function RestablecerPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando…
        </div>
      }
    >
      <RestablecerPasswordFormView />
    </Suspense>
  );
}
