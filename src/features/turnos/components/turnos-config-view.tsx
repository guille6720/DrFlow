"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { toast } from "@/core/notifications/toast";

import {
  createTurnosAvailabilityRule,
  deleteAvailabilityRule,
  deleteScheduleBlock,
  setAvailabilityRuleActive,
  updateAvailabilityRule,
} from "@/features/turnos/actions/turnos-config";
import type {
  TurnosConfigBlockRow,
  TurnosConfigRuleRow,
} from "@/features/turnos/server/load-turnos-config-page";
import { BLOCK_REASON_OPTIONS } from "@/features/turnos/utils/appointment-lifecycle";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createScheduleBlock } from "@/lib/actions/settings";

type Props = {
  rules: TurnosConfigRuleRow[];
  blocks: TurnosConfigBlockRow[];
  professionals: Array<{ id: string; name: string }>;
  defaultDuration: number;
  dayNames: string[];
};

function formatTimeForInput(value: string): string {
  return value.slice(0, 5);
}

export function TurnosConfigView({ rules, blocks, professionals, defaultDuration, dayNames }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  async function runAction(id: string, action: () => Promise<{ error?: string; success?: boolean }>) {
    setBusyId(id);
    const result = await action();
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return false;
    }
    toast.success("Actualizado");
    router.refresh();
    return true;
  }

  const professionalOptions = professionals.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Configuración de agenda</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Horarios semanales, bloqueos y duración de turnos por profesional.
        </p>
      </div>

      <Card title="Horarios semanales">
        {rules.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No hay horarios cargados.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                {editingRuleId === rule.id ? (
                  <form
                    className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      void (async () => {
                        const ok = await runAction(rule.id, () =>
                          updateAvailabilityRule(rule.id, {
                            day_of_week: Number(formData.get("day_of_week")),
                            start_time: String(formData.get("start_time")),
                            end_time: String(formData.get("end_time")),
                            slot_duration: Number(formData.get("slot_duration")),
                          })
                        );
                        if (ok) setEditingRuleId(null);
                      })();
                    }}
                  >
                    <Select
                      name="day_of_week"
                      label="Día"
                      required
                      defaultValue={String(rule.day_of_week)}
                      options={dayNames.map((label, index) => ({ value: String(index), label }))}
                    />
                    <Input
                      name="start_time"
                      label="Desde"
                      type="time"
                      defaultValue={formatTimeForInput(rule.start_time)}
                      required
                    />
                    <Input
                      name="end_time"
                      label="Hasta"
                      type="time"
                      defaultValue={formatTimeForInput(rule.end_time)}
                      required
                    />
                    <Input
                      name="slot_duration"
                      label="Duración (min)"
                      type="number"
                      defaultValue={String(rule.slot_duration)}
                      min={10}
                      max={120}
                      required
                    />
                    <div className="flex flex-wrap items-end gap-2">
                      <Button type="submit" size="sm" disabled={busyId === rule.id}>
                        Guardar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === rule.id}
                        onClick={() => setEditingRuleId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <p className="font-medium">
                        {rule.professional_name} · {dayNames[rule.day_of_week]} · {rule.start_time}–
                        {rule.end_time}
                      </p>
                      <p className="text-[var(--muted-foreground)]">
                        Turnos de {rule.slot_duration} min ·{" "}
                        {rule.is_active ? "Activo" : "Inactivo"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === rule.id}
                        onClick={() => setEditingRuleId(rule.id)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === rule.id}
                        onClick={() =>
                          void runAction(rule.id, () =>
                            setAvailabilityRuleActive(rule.id, !rule.is_active)
                          )
                        }
                      >
                        {rule.is_active ? "Desactivar" : "Activar"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={busyId === rule.id}
                        onClick={() =>
                          void runAction(rule.id, () => deleteAvailabilityRule(rule.id))
                        }
                      >
                        {busyId === rule.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Eliminar
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            void runAction("new-rule", () => createTurnosAvailabilityRule(new FormData(e.currentTarget)));
          }}
        >
          <Select name="professional_id" label="Profesional" required options={professionalOptions} />
          <Select
            name="day_of_week"
            label="Día"
            required
            options={dayNames.map((label, index) => ({ value: String(index), label }))}
          />
          <Input name="start_time" label="Desde" type="time" defaultValue="09:00" required />
          <Input name="end_time" label="Hasta" type="time" defaultValue="18:00" required />
          <Input
            name="slot_duration"
            label="Duración (min)"
            type="number"
            defaultValue={String(defaultDuration)}
            min={10}
            max={120}
          />
          <div className="flex items-end">
            <Button type="submit" disabled={busyId === "new-rule"}>
              Agregar horario
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Bloqueos de agenda">
        {blocks.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No hay bloqueos futuros.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {blocks.map((block) => (
              <li key={block.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{block.professional_name}</p>
                  <p className="text-[var(--muted-foreground)]">
                    {format(parseISO(block.start_at), "d MMM yyyy HH:mm", { locale: es })} –{" "}
                    {format(parseISO(block.end_at), "HH:mm", { locale: es })}
                    {block.reason ? ` · ${block.reason}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  disabled={busyId === block.id}
                  onClick={() => void runAction(block.id, () => deleteScheduleBlock(block.id))}
                >
                  Eliminar
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runAction("new-block", async () => {
              const result = await createScheduleBlock(new FormData(e.currentTarget));
              return result;
            });
          }}
        >
          <Select name="professional_id" label="Profesional" required options={professionalOptions} />
          <Select
            name="reason"
            label="Motivo"
            defaultValue="manual"
            options={BLOCK_REASON_OPTIONS.map((option) => ({
              value: option.label,
              label: option.label,
            }))}
          />
          <Input name="start_at" label="Desde" type="datetime-local" required />
          <Input name="end_at" label="Hasta" type="datetime-local" required />
          <Button type="submit" className="sm:col-span-2" disabled={busyId === "new-block"}>
            Crear bloqueo
          </Button>
        </form>
      </Card>
    </div>
  );
}
