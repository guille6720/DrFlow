"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  loadPublicBookingSlots,
  submitPublicBooking,
} from "@/lib/actions/public-booking";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import { CheckCircle2 } from "lucide-react";

interface Professional {
  id: string;
  display_name?: string | null;
  license_number?: string | null;
  bio?: string | null;
  specialties?: { name: string } | { name: string }[] | null;
}

interface Props {
  slug: string;
  clinicName: string;
  professionals: Professional[];
}

export function PublicBookingForm({ slug, clinicName, professionals }: Props) {
  const router = useRouter();
  const [professionalId, setProfessionalId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [slots, setSlots] = useState<Array<{ start_at: string; label: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingSlots, startLoadSlots] = useTransition();
  const [submitting, startSubmit] = useTransition();

  useEffect(() => {
    if (!professionalId) return;

    startLoadSlots(async () => {
      const result = await loadPublicBookingSlots(slug, professionalId);
      setSlots(result.slots ?? []);
      setStartAt("");
    });
  }, [professionalId, slug]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startSubmit(async () => {
      const formData = new FormData(e.currentTarget);
      formData.set("slug", slug);
      formData.set("professional_id", professionalId);
      formData.set("start_at", startAt);

      const result = await submitPublicBooking(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        router.refresh();
      }
    });
  }

  if (success) {
    return (
      <Card>
        <div className="flex flex-col items-center py-8 text-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-600" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">¡Solicitud enviada!</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-600">
            {clinicName} recibió tu pedido de turno. Recepción te contactará por teléfono o email para confirmar.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Reservá tu turno">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Profesional"
          required
          value={professionalId}
          onChange={(e) => {
            const next = e.target.value;
            setProfessionalId(next);
            setStartAt("");
            if (!next) setSlots([]);
          }}
          options={professionals.map((p) => {
            const spec = Array.isArray(p.specialties) ? p.specialties[0] : p.specialties;
            return {
              value: p.id,
              label: `${getProfessionalDisplayName(p)}${spec?.name ? ` — ${spec.name}` : ""}`,
            };
          })}
          placeholder="Elegí un profesional"
        />

        {professionalId && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Horario disponible
            </label>
            {loadingSlots ? (
              <p className="text-sm text-slate-500">Cargando horarios...</p>
            ) : slots.length === 0 ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                No hay turnos libres en los próximos 14 días para este profesional.
              </p>
            ) : (
              <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {slots.map((slot) => (
                  <button
                    key={slot.start_at}
                    type="button"
                    onClick={() => setStartAt(slot.start_at)}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                      startAt === slot.start_at
                        ? "border-teal-600 bg-teal-50 text-teal-800"
                        : "border-slate-200 bg-white text-slate-700 hover:border-teal-300"
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="first_name" label="Nombre" required />
          <Input name="last_name" label="Apellido" required />
          <Input name="document_number" label="DNI" required />
          <Input name="phone" label="Teléfono" type="tel" required />
          <Input name="email" label="Email" type="email" className="sm:col-span-2" />
        </div>

        <Textarea name="reason" label="Motivo de consulta (opcional)" rows={2} />

        <p className="text-xs text-slate-500">
          Tu turno quedará en estado <strong>pendiente</strong> hasta que recepción lo confirme.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <Button
          type="submit"
          className="w-full"
          loading={submitting}
          disabled={!professionalId || !startAt}
        >
          Enviar solicitud de turno
        </Button>
      </form>
    </Card>
  );
}
