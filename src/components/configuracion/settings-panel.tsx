"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  updateClinicSettings,
  createSpecialty,
  deleteSpecialty,
  createLocation,
  deleteLocation,
  createConsultationReason,
  createProfessional,
  enablePublicBooking,
  createAvailabilityRule,
  createScheduleBlock,
} from "@/lib/actions/settings";
import type { Clinic } from "@/types/database";
import { ExternalLink, Plus, Trash2, Copy } from "lucide-react";
import Link from "next/link";
import { TeamInvitePanel } from "@/components/configuracion/team-invite-panel";
import { AppInstallCard } from "@/components/portal/app-install-card";

interface SettingsPanelProps {
  clinic: Clinic | null;
  specialties: { id: string; name: string }[];
  locations: { id: string; name: string; address: string | null }[];
  professionals: {
    id: string;
    display_name: string | null;
    license_number: string | null;
    profiles?: { full_name: string } | null;
    specialties?: { name: string } | null;
  }[];
  members: {
    id: string;
    role: string;
    is_active?: boolean;
    profiles?: { full_name: string; email: string } | null;
  }[];
  invitations: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    status: string;
    created_at: string;
  }[];
  reasons: { id: string; name: string }[];
  bookingSlug: string | null;
}

export function SettingsPanel({
  clinic,
  specialties,
  locations,
  professionals,
  members,
  invitations,
  reasons,
  bookingSlug,
}: SettingsPanelProps) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(action: () => Promise<{ error?: string; success?: boolean; slug?: string }>) {
    setMsg(null);
    setErr(null);
    const r = await action();
    if (r.error) setErr(r.error);
    else {
      setMsg(r.slug ? `Link activo: /solicitar-turno/${r.slug}` : "Guardado correctamente");
      router.refresh();
    }
  }

  if (!clinic) return <p className="text-sm text-slate-500">Sin clínica activa.</p>;

  return (
    <div className="space-y-6">
      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</div>}
      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>}

      <Card title="Datos de la clínica">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateClinicSettings(new FormData(e.currentTarget)));
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Input name="name" label="Nombre" defaultValue={clinic.name} required />
          <Input name="email" label="Email" type="email" defaultValue={clinic.email ?? ""} />
          <Input name="phone" label="Teléfono" defaultValue={clinic.phone ?? ""} />
          <Input name="address" label="Dirección" defaultValue={clinic.address ?? ""} />
          <Input
            name="default_appointment_duration"
            label="Duración turno (min)"
            type="number"
            defaultValue={clinic.default_appointment_duration}
          />
          <div className="sm:col-span-2">
            <Button type="submit">Guardar clínica</Button>
          </div>
        </form>
      </Card>

      <Card title="DrFlow en tu celular (médico)">
        <p className="mb-4 text-sm text-slate-600">
          Agregá DrFlow a la pantalla de inicio de tu celular para acceder al dashboard y la agenda.
        </p>
        <AppInstallCard variant="clinic" />
      </Card>

      <Card title="App pacientes (PWA)">
        <p className="mb-3 text-sm text-slate-600">
          Versión reducida instalable: turnos, solicitud de recetas y WhatsApp. Compartí este link
          con tus pacientes PAMI.
        </p>
        {bookingSlug || clinic.slug ? (
          <div className="space-y-4">
            {(() => {
              const slug = bookingSlug ?? clinic.slug;
              return (
                <>
                  <Link
                    href={`/portal/${slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
                  >
                    /portal/{slug}
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const url = `${window.location.origin}/portal/${slug}`;
                      navigator.clipboard.writeText(url);
                      setMsg(`Link app pacientes copiado: ${url}`);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar link app pacientes
                  </Button>
                  <AppInstallCard
                    variant="patient"
                    slug={slug}
                    clinicName={clinic.name}
                  />
                </>
              );
            })()}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Activá la reserva pública para generar el portal.</p>
            <AppInstallCard variant="patient" />
          </div>
        )}
      </Card>

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
                  setMsg(`Link copiado: ${url}`);
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
          <Button onClick={() => run(enablePublicBooking)}>Activar reserva pública</Button>
        )}
      </Card>

      <TeamInvitePanel members={members} invitations={invitations} />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Link
          href="/qa"
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          Abrir checklist QA interactivo →
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Especialidades">
          <ul className="mb-4 space-y-2 text-sm">
            {specialties.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                {s.name}
                <button type="button" onClick={() => run(() => deleteSpecialty(s.id))} className="text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = new FormData(e.currentTarget).get("name") as string;
              run(() => createSpecialty(name)).then(() => e.currentTarget.reset());
            }}
            className="flex gap-2"
          >
            <Input name="name" placeholder="Nueva especialidad" required className="flex-1" />
            <Button type="submit" size="sm"><Plus className="h-4 w-4" /></Button>
          </form>
        </Card>

        <Card title="Sedes">
          <ul className="mb-4 space-y-2 text-sm">
            {locations.map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{l.name}{l.address ? ` — ${l.address}` : ""}</span>
                <button type="button" onClick={() => run(() => deleteLocation(l.id))} className="text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() => createLocation(fd.get("name") as string, fd.get("address") as string)).then(() =>
                e.currentTarget.reset()
              );
            }}
            className="space-y-2"
          >
            <Input name="name" placeholder="Nombre sede" required />
            <Input name="address" placeholder="Dirección" />
            <Button type="submit" size="sm">Agregar sede</Button>
          </form>
        </Card>

        <Card title="Profesionales">
          <ul className="mb-4 space-y-2 text-sm">
            {professionals.map((p) => (
              <li key={p.id} className="rounded-lg bg-slate-50 px-3 py-2">
                {p.display_name ?? p.profiles?.full_name ?? "Profesional"}
                {p.specialties?.name && ` · ${p.specialties.name}`}
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => createProfessional(new FormData(e.currentTarget))).then(() => e.currentTarget.reset());
            }}
            className="space-y-2"
          >
            <Input name="display_name" placeholder="Nombre visible" required />
            <Input name="license_number" placeholder="Matrícula" />
            <Select
              name="specialty_id"
              options={specialties.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Especialidad"
            />
            <Button type="submit" size="sm">Agregar profesional</Button>
          </form>
        </Card>

        <Card title="Motivos de consulta">
          <ul className="mb-4 space-y-1 text-sm">
            {reasons.map((r) => (
              <li key={r.id}>{r.name}</li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = new FormData(e.currentTarget).get("name") as string;
              run(() => createConsultationReason(name)).then(() => e.currentTarget.reset());
            }}
            className="flex gap-2"
          >
            <Input name="name" placeholder="Nuevo motivo" required className="flex-1" />
            <Button type="submit" size="sm"><Plus className="h-4 w-4" /></Button>
          </form>
        </Card>
      </div>

      <Card title="Disponibilidad semanal">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createAvailabilityRule(new FormData(e.currentTarget)));
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Select
            name="professional_id"
            label="Profesional"
            required
            options={professionals.map((p) => ({
              value: p.id,
              label: p.display_name ?? p.profiles?.full_name ?? "Profesional",
            }))}
          />
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
            run(() => createScheduleBlock(new FormData(e.currentTarget)));
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <Select
            name="professional_id"
            label="Profesional"
            required
            options={professionals.map((p) => ({
              value: p.id,
              label: p.display_name ?? p.profiles?.full_name ?? "Profesional",
            }))}
          />
          <Input name="reason" label="Motivo" defaultValue="Bloqueo" />
          <Input name="start_at" label="Desde" type="datetime-local" required />
          <Input name="end_at" label="Hasta" type="datetime-local" required />
          <Button type="submit" className="sm:col-span-2">Crear bloqueo</Button>
        </form>
      </Card>
    </div>
  );
}
