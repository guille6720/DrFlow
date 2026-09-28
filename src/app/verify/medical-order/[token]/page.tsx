import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import type { Metadata } from "next";

import { createClient } from "@/core/supabase/server";

import { MEDICAL_ORDER_SIGNATURE_DISCLAIMER } from "@/features/ordenes-medicas/constants";
import type { MedicalOrderVerification } from "@/features/ordenes-medicas/types";
import {
  categoryLabel,
  formatDateAr,
  formatDateTimeAr,
  isValidVerificationToken,
} from "@/features/ordenes-medicas/utils/medical-order-format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verificación de orden médica — NexClinic",
  robots: { index: false, follow: false },
};

async function verify(token: string): Promise<MedicalOrderVerification> {
  if (!isValidVerificationToken(token)) return { found: false };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("verify_medical_order" as never, { p_token: token } as never);
    if (error || !data) return { found: false };
    return data as MedicalOrderVerification;
  } catch {
    return { found: false };
  }
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value?.trim() || "—"}</span>
    </div>
  );
}

export default async function VerifyMedicalOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await verify(token);

  return (
    <main className="flex min-h-[100dvh] items-start justify-center bg-slate-50 px-4 py-10 text-slate-900">
      <div className="w-full max-w-md space-y-4">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
          NexClinic · Verificación de orden médica
        </p>

        {!result.found ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <ShieldAlert className="mx-auto h-12 w-12 text-amber-500" aria-hidden />
            <h1 className="mt-3 text-lg font-semibold">Orden no encontrada</h1>
            <p className="mt-1 text-sm text-slate-600">
              El código no corresponde a una orden emitida. Verificá que el QR o el enlace estén completos.
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-center">
              {result.status === "anulada" ? (
                <XCircle className="mx-auto h-12 w-12 text-red-600" aria-hidden />
              ) : (
                <CheckCircle2
                  className={`mx-auto h-12 w-12 ${result.expired ? "text-amber-500" : "text-emerald-600"}`}
                  aria-hidden
                />
              )}
              <h1
                className={`mt-3 text-2xl font-bold ${
                  result.status === "anulada" ? "text-red-700" : result.expired ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {result.status === "anulada" ? "ANULADA" : result.expired ? "Válida — vencida" : "Válida"}
              </h1>
              <p className="mt-1 font-mono text-sm text-slate-600">{result.order_number}</p>
            </div>

            <div className="mt-5">
              <Row label="Tipo" value={categoryLabel(result.order_category)} />
              <Row label="Ítems solicitados" value={String(result.items_count ?? 0)} />
              <Row label="Paciente" value={result.patient_initials} />
              <Row label="Documento" value={result.patient_document_masked} />
              <Row label="Profesional" value={result.professional_name} />
              <Row label="Matrícula" value={result.professional_license} />
              <Row label="Consultorio" value={result.clinic_name} />
              <Row label="Emitida" value={formatDateTimeAr(result.issued_at)} />
              <Row label="Válida hasta" value={formatDateAr(result.valid_until)} />
              {result.status === "anulada" ? <Row label="Anulada" value={formatDateTimeAr(result.voided_at)} /> : null}
            </div>

            <p className="mt-4 text-xs text-slate-500">
              El detalle clínico no se muestra públicamente. Compará el N.º de orden con el documento impreso.
            </p>
          </section>
        )}

        <p className="text-center text-xs leading-relaxed text-slate-500">{MEDICAL_ORDER_SIGNATURE_DISCLAIMER}</p>
      </div>
    </main>
  );
}
