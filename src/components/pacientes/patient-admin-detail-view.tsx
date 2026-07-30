import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Patient } from "@/types/database";

export function PatientAdminDetailView({ patient }: { patient: Patient }) {
  return (
    <div className="space-y-4">
      <Card title="Datos administrativos">
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-slate-500">Teléfono</dt>
            <dd>{patient.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd>{patient.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Dirección</dt>
            <dd>{patient.address ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Obra social</dt>
            <dd className="flex items-center gap-2">
              {patient.insurance_provider ?? "—"}
              {patient.insurance_provider?.toUpperCase().includes("PAMI") && (
                <Badge variant="teal">PAMI</Badge>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Plan</dt>
            <dd>{(patient as { insurance_plan?: string }).insurance_plan ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">N° afiliado</dt>
            <dd>{patient.insurance_number ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Emergencia</dt>
            <dd>
              {patient.emergency_contact_name ?? "—"}
              {patient.emergency_contact_phone ? ` (${patient.emergency_contact_phone})` : ""}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/pacientes/${patient.id}/editar`}>
            <Button size="sm">Editar datos</Button>
          </Link>
          <Link href={`/caja/cuenta-corriente?patient=${patient.id}`}>
            <Button size="sm" variant="outline">
              Cuenta corriente
            </Button>
          </Link>
          <Link href={`/secretaria/documentos?patient=${patient.id}`}>
            <Button size="sm" variant="outline">
              Documentos
            </Button>
          </Link>
        </div>
      </Card>
      <Card title="Información clínica">
        <p className="text-sm text-slate-500">
          La historia clínica, diagnósticos y recetas son accesibles únicamente para el equipo
          médico autorizado.
        </p>
      </Card>
    </div>
  );
}
