"use client";

import Link from "next/link";
import {
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
} from "@/lib/legal/documents";

interface Props {
  name?: string;
  className?: string;
}

export function LegalAcceptanceCheckbox({ name = "legal_accepted", className }: Props) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-600 ${className ?? ""}`}>
      <input
        type="checkbox"
        name={name}
        value="true"
        required
        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
      />
      <span>
        Acepto los{" "}
        <Link href="/terminos" className="font-medium text-teal-700 underline" target="_blank">
          Términos del servicio
        </Link>{" "}
        (v{LEGAL_TERMS_VERSION}) y la{" "}
        <Link href="/privacidad" className="font-medium text-teal-700 underline" target="_blank">
          Política de privacidad
        </Link>{" "}
        (v{LEGAL_PRIVACY_VERSION}). Declaro ser titular o representante autorizado del consultorio y
        responsable del tratamiento de datos de mis pacientes conforme la normativa vigente en
        Argentina.
      </span>
    </label>
  );
}

export function PatientDataConsentCheckbox({ slug }: { slug: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-700">
      <input
        type="checkbox"
        name="privacy_consent"
        value="true"
        required
        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
      />
      <span>
        Autorizo a la clínica a tratar mis datos personales y de contacto para gestionar este turno,
        conforme la{" "}
        <Link
          href={`/aviso-paciente?clinic=${encodeURIComponent(slug)}`}
          className="font-medium text-emerald-800 underline"
          target="_blank"
        >
          información al paciente
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" className="font-medium text-emerald-800 underline" target="_blank">
          política de privacidad
        </Link>
        . (Ley 25.326 / Ley 26.529)
      </span>
    </label>
  );
}
