"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { clearDrFlowClientStorage } from "@/lib/utils/clear-client-storage";

export function AccountDeletedCleanup() {
  const searchParams = useSearchParams();
  const accountDeleted = searchParams.get("cuenta") === "eliminada";

  useEffect(() => {
    if (!accountDeleted) return;
    clearDrFlowClientStorage();
  }, [accountDeleted]);

  if (!accountDeleted) return null;

  return (
    <div className="mx-auto mb-6 max-w-2xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
      Tu cuenta fue eliminada por completo. Podés{" "}
      <Link href="/register" className="font-semibold text-teal-800 underline-offset-2 hover:underline">
        registrar un nuevo consultorio
      </Link>{" "}
      o seguir navegando el sitio.
    </div>
  );
}
