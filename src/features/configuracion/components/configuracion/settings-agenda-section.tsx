"use client";

import { Copy, ExternalLink } from "lucide-react";
import Link from "next/link";

import { nestedProfileFullName } from "@/core/supabase/nested-row";
import type { NestedRow } from "@/core/supabase/query-types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createAvailabilityRule,
  createScheduleBlock,
  enablePublicBooking,
} from "@/lib/actions/settings";
import type { Clinic } from "@/types/database";

type ProfessionalOption = {
  id: string;
  display_name: string | null;
  profiles?: NestedRow<{ full_name: string }>;
};

type Props = {
  clinic: Clinic;
  bookingSlug: string | null;
  professionals: ProfessionalOption[];
  onResult: (action: () => Promise<{ error?: string; success?: boolean; slug?: string }>) => void;
  onMessage: (message: string) => void;
};

export function SettingsAgendaSection({
  clinic,
  bookingSlug,
  professionals,
  onResult,
  onMessage,
}: Props) {
  const professionalOptions = professionals.map((p) => ({
    value: p.id,
    label: p.display_name ?? nestedProfileFullName(p.profiles) ?? "Profesional",
  }));

  return (
    <>
      <Card title="Reserva pública online">
        <p className="mb-3 text-sm text-slate-600">
          Tu página de turnos usa el nombre de la clínica. Compartí el link para que pacientes reserven online.
        </p>
        {bookingSlug ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-800">{clinic.name}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/solicitar-turno/${bookingSlug}`}
                target="_blank"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
              >
                /solicitar-turno/{bookingSlug}
                <ExternalLink className="h-4 w-4" />
              </Link>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const url = `${window.location.origin}/solicitar-turno/${bookingSlug}`;
                  navigator.clipboard.writeText(url);
                  onMessage(`Link copiado: ${url}`);
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar link
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Los turnos tomados por la web aparecen en la agenda con el ícono 🌐 Web.
            </p>
          </div>
        ) : (
          <Button onClick={() => onResult(enablePublicBooking)}>Activar reserva pública</Button>
        )}
      </Card>

      <Card title="Disponibilidad semanal">
        <p className="mb-3 text-sm text-slate-600">
          Estos horarios alimentan los turnos online del portal y de{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">/solicitar-turno</code>. Si no cargás
          reglas, el paciente no va a ver horarios disponibles.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onResult(() => createAvailabilityRule(new FormData(e.currentTarget)));
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Select name="professional_id" label="Profesional" required options={professionalOptions} />
          <Select
            name="day_of_week"
            label="Día"
            required
            options={[
              { value: "1", label: "Lunes" },
              { value: "2", label: "Martes" },
              { value: "3", label: "Miércoles" },
              { value: "4", label: "Jueves" },
              { value: "5", label: "Viernes" },
              { value: "6", label: "Sábado" },
              { value: "0", label: "Domingo" },
            ]}
          />
          <Input name="start_time" label="Desde" type="time" defaultValue="09:00" required />
          <Input name="end_time" label="Hasta" type="time" defaultValue="18:00" required />
          <Input name="slot_duration" label="Duración slot (min)" type="number" defaultValue="30" />
          <div className="flex items-end">
            <Button type="submit">Agregar horario</Button>
          </div>
        </form>
      </Card>

      <Card title="Bloqueo de agenda">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onResult(() => createScheduleBlock(new FormData(e.currentTarget)));
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <Select name="professional_id" label="Profesional" required options={professionalOptions} />
          <Input name="reason" label="Motivo" defaultValue="Bloqueo" />
          <Input name="start_at" label="Desde" type="datetime-local" required />
          <Input name="end_at" label="Hasta" type="datetime-local" required />
          <Button type="submit" className="sm:col-span-2">
            Crear bloqueo
          </Button>
        </form>
      </Card>
    </>
  );
}
