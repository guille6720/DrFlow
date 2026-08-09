"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";

import { updateWaitingListStatus } from "@/features/turnos/actions/waiting-list";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type WaitingListRow = {
  id: string;
  status: string;
  notes: string | null;
  consultation_modality: string;
  preferred_date_from: string | null;
  preferred_date_to: string | null;
  preferred_time_from: string | null;
  preferred_time_to: string | null;
  created_at: string;
  patients: { first_name: string; last_name: string; document_number: string; phone: string | null } | null;
  professionals: { display_name: string | null; profiles: { full_name: string | null } | null } | null;
  specialties: { name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  contacted: "Contactado",
  scheduled: "Agendado",
  cancelled: "Cancelado",
};

export function WaitingListView({ entries }: { entries: WaitingListRow[] }) {
  async function handleStatus(id: string, status: "contacted" | "scheduled" | "cancelled") {
    await updateWaitingListStatus(id, status);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Lista de espera</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Pacientes esperando un turno compatible. Cuando se libera un horario, contactalos desde acá.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted-foreground)]">No hay pacientes en lista de espera.</p>
        </Card>
      ) : (
        entries.map((entry) => {
          const patient = entry.patients;
          const professional = entry.professionals;
          const profName =
            professional?.display_name ??
            (professional?.profiles as { full_name?: string } | null)?.full_name ??
            "Cualquier profesional";

          return (
            <Card key={entry.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">
                    {patient ? `${patient.last_name}, ${patient.first_name}` : "Paciente"}
                    {patient?.document_number ? ` · DNI ${patient.document_number}` : ""}
                  </p>
                  <p className="text-[var(--muted-foreground)]">
                    {entry.specialties?.name ?? "Sin especialidad"} · {profName}
                  </p>
                  <p>
                    Preferencia:{" "}
                    {entry.preferred_date_from
                      ? format(new Date(entry.preferred_date_from), "d MMM yyyy", { locale: es })
                      : "Flexible"}
                    {entry.preferred_date_to
                      ? ` — ${format(new Date(entry.preferred_date_to), "d MMM yyyy", { locale: es })}`
                      : ""}
                    {entry.preferred_time_from ? ` · desde ${entry.preferred_time_from.slice(0, 5)}` : ""}
                    {entry.preferred_time_to ? ` hasta ${entry.preferred_time_to.slice(0, 5)}` : ""}
                  </p>
                  <p>
                    Modalidad: {entry.consultation_modality === "virtual" ? "Virtual" : "Presencial"} ·{" "}
                    <span className="font-medium">{STATUS_LABEL[entry.status] ?? entry.status}</span>
                  </p>
                  {entry.notes ? <p className="text-[var(--muted-foreground)]">{entry.notes}</p> : null}
                  {patient?.phone ? (
                    <a
                      href={`https://wa.me/${patient.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-[var(--primary)] hover:underline"
                    >
                      Contactar por WhatsApp
                    </a>
                  ) : null}
                </div>
                {entry.status === "active" || entry.status === "contacted" ? (
                  <div className="flex flex-wrap gap-2">
                    {entry.status === "active" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleStatus(entry.id, "contacted")}
                      >
                        Marcar contactado
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleStatus(entry.id, "scheduled")}
                    >
                      Turno agendado
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleStatus(entry.id, "cancelled")}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
