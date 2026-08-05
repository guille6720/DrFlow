import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

import { CLINICAL_RECORD_RETENTION_YEARS, LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION } from "@/core/legal/documents";

import { Card } from "@/components/ui/card";
import { getClinicComplianceSummary } from "@/lib/actions/compliance";

export async function ComplianceLegalPanel() {
  const summary = await getClinicComplianceSummary();
  if ("error" in summary && summary.error) {
    return null;
  }

  const clinic = summary.clinic;
  const termsOk = clinic?.legal_terms_version === LEGAL_TERMS_VERSION;
  const privacyOk = clinic?.legal_privacy_version === LEGAL_PRIVACY_VERSION;

  return (
    <Card
      title="Cumplimiento legal y datos personales"
      description="Ley 25.326, Ley 26.529 y buenas prácticas para consultorios en Argentina."
    >
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-600/50 bg-slate-800/40 p-4">
            <p className="font-semibold text-slate-100">Términos del servicio</p>
            <p className="mt-1 text-slate-300">
              Versión vigente: {LEGAL_TERMS_VERSION}
              <br />
              Aceptada:{" "}
              {clinic?.legal_terms_accepted_at
                ? format(new Date(clinic.legal_terms_accepted_at), "PPp", { locale: es })
                : "Pendiente — aceptá al registrarte o contactá soporte"}
              <br />
              Registrada: {clinic?.legal_terms_version ?? "—"}{" "}
              {termsOk ? (
                <span className="text-emerald-400">(actualizada)</span>
              ) : (
                <span className="text-amber-300">(revisar / re-aceptar en próximo login)</span>
              )}
            </p>
            <Link href="/terminos" className="drflow-link mt-2 inline-block text-xs">
              Ver términos
            </Link>
          </div>
          <div className="rounded-xl border border-slate-600/50 bg-slate-800/40 p-4">
            <p className="font-semibold text-slate-100">Privacidad</p>
            <p className="mt-1 text-slate-300">
              Versión vigente: {LEGAL_PRIVACY_VERSION}
              <br />
              Registrada en clínica: {clinic?.legal_privacy_version ?? "—"}{" "}
              {privacyOk ? (
                <span className="text-emerald-400">(actualizada)</span>
              ) : (
                <span className="text-amber-300">(actualizar aceptación)</span>
              )}
            </p>
            <Link href="/privacidad" className="drflow-link mt-2 inline-block text-xs">
              Ver política
            </Link>
          </div>
        </div>

        <ul className="list-disc space-y-2 pl-5 text-slate-300">
          <li>
            <strong className="text-slate-100">Responsable del tratamiento:</strong> este consultorio
            ({clinic?.name}). DrFlow actúa como encargado de procesamiento técnico.
          </li>
          <li>
            Consentimientos de pacientes registrados (turnos web):{" "}
            <strong className="text-teal-300">{summary.consentCount}</strong>
          </li>
          <li>
            Conservación de historias clínicas: mínimo recomendado{" "}
            <strong>{CLINICAL_RECORD_RETENTION_YEARS} años</strong> (práctica habitual / Ley 26.529).
          </li>
          <li>
            Recetas: emisión local Ley 25.649 con aviso explícito —{" "}
            <strong>no sustituye homologación REFEPS</strong> hasta trámite nacional.
          </li>
          <li>
            Exportación ARCO: desde la ficha de cada paciente, botón &quot;Exportar datos (ARCO)&quot;.
          </li>
        </ul>

        <p className="text-xs text-slate-400">
          Documentación interna:{" "}
          <code className="rounded bg-slate-800 px-1">docs/CUMPLIMIENTO_LEGAL.md</code> en el repositorio.
          Ante reclamos del paciente, derivá a la autoridad de aplicación (AAIP) y conservá evidencia de
          consentimientos.
        </p>
      </div>
    </Card>
  );
}
