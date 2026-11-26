"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { changeLaMejorTrialEnd, openLaMejorTeamPermissions } from "@/lib/actions/superadmin-commercial";

export function LaMejorTrialControls({ endsAt }: { endsAt: string }) {
  const router = useRouter();
  const [currentEnd, setCurrentEnd] = useState(endsAt);
  const [value, setValue] = useState(formatClinicDateTime(endsAt, "yyyy-MM-dd'T'HH:mm"));
  const [result, setResult] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, startSave] = useTransition();
  const [opening, startOpen] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("expectedAt", currentEnd);
    setResult(null);
    startSave(async () => {
      try {
        const updated = await changeLaMejorTrialEnd(form);
        if (!updated.ok) {
          setResult({ text: updated.error, error: true });
          return;
        }
        setCurrentEnd(updated.endsAt);
        setResult({ text: "Vencimiento actualizado." });
        router.refresh();
      } catch {
        setResult({ text: "No pudimos guardar el vencimiento.", error: true });
      }
    });
  }

  function openTeam() {
    startOpen(async () => {
      try {
        const access = await openLaMejorTeamPermissions();
        if (access.ok) router.push("/configuracion?grupo=consultorio&seccion=equipo#permisos-equipo");
        else setResult({ text: access.error, error: true });
      } catch {
        setResult({ text: "No pudimos abrir los permisos del equipo.", error: true });
      }
    });
  }

  return (
    <Card title="Prueba gratuita de LaMejor">
      <p className="mb-4 text-sm">Vence el <strong>{formatClinicDateTime(currentEnd, "d 'de' MMMM 'de' yyyy · HH:mm")}</strong> (Buenos Aires).</p>
      <form onSubmit={save} className="space-y-3">
        <label className="block text-sm">
          Nuevo vencimiento
          <input className="mt-1 block w-full rounded-lg border bg-transparent p-2" name="endsAt" type="datetime-local" required value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
        <label className="block text-sm">
          Motivo del cambio
          <input className="mt-1 block w-full rounded-lg border bg-transparent p-2" name="reason" required maxLength={250} />
        </label>
        <Button type="submit" loading={saving} disabled={value === formatClinicDateTime(currentEnd, "yyyy-MM-dd'T'HH:mm")}>Guardar vencimiento</Button>
      </form>
      <div className="mt-4 border-t pt-4">
        <Button type="button" variant="outline" loading={opening} onClick={openTeam}>Editar permisos por usuario</Button>
      </div>
      {result && <p role={result.error ? "alert" : "status"} className="mt-3 text-sm">{result.text}</p>}
    </Card>
  );
}
