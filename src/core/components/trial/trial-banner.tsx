"use client";

import { Clock } from "lucide-react";
import Link from "next/link";

type TrialBannerProps = {
  trialEndsAt: string;
  daysRemaining: number;
};

export function TrialBanner({ trialEndsAt, daysRemaining }: TrialBannerProps) {
  const endLabel = new Date(trialEndsAt).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const urgent = daysRemaining <= 3;

  return (
    <div
      role="status"
      className={
        urgent
          ? "border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950"
          : "border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-950"
      }
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 lg:pl-64">
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        <p className="flex-1">
          {daysRemaining === 1 ? (
            <>Queda <strong>1 día</strong> de tu prueba gratuita</>
          ) : (
            <>
              Quedan <strong>{daysRemaining} días</strong> de tu prueba gratuita
            </>
          )}{" "}
          (hasta el {endLabel}).
        </p>
        <Link
          href="/planes"
          className="font-medium underline underline-offset-2 hover:no-underline"
        >
          Ver planes
        </Link>
      </div>
    </div>
  );
}
