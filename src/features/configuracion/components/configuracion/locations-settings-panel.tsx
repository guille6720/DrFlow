"use client";

import { MapPin, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createLocation,
  deleteLocation,
  setLocationActive,
  updateLocation,
} from "@/lib/actions/settings";

export type ClinicLocationRow = {
  id: string;
  name: string;
  address: string | null;
  phone?: string | null;
  is_active?: boolean;
};

type Props = {
  locations: ClinicLocationRow[];
};

export function LocationsSettingsPanel({ locations }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("create");
    setMsg(null);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const result = await createLocation(
      String(fd.get("name") ?? ""),
      String(fd.get("address") ?? "") || undefined,
      String(fd.get("phone") ?? "") || undefined
    );
    setLoading(null);
    if (result.error) setErr(result.error);
    else {
      setMsg("Sede creada.");
      e.currentTarget.reset();
      router.refresh();
    }
  }

  async function handleUpdate(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(id);
    setMsg(null);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const result = await updateLocation(id, {
      name: String(fd.get("name") ?? ""),
      address: String(fd.get("address") ?? "") || undefined,
      phone: String(fd.get("phone") ?? "") || undefined,
    });
    setLoading(null);
    if (result.error) setErr(result.error);
    else {
      setMsg("Sede actualizada.");
      setEditingId(null);
      router.refresh();
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    setLoading(id);
    const result = await setLocationActive(id, isActive);
    setLoading(null);
    if (result.error) setErr(result.error);
    else router.refresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`¿Eliminar la sede "${name}"? Los turnos existentes conservan el historial.`)) return;
    setLoading(id);
    const result = await deleteLocation(id);
    setLoading(null);
    if (result.error) setErr(result.error);
    else {
      setMsg("Sede eliminada.");
      router.refresh();
    }
  }

  return (
    <Card title="Sedes del consultorio">
      <p className="mb-4 text-sm text-slate-700">
        Gestioná las sedes donde atendés. Los turnos, profesionales y horarios semanales pueden
        asociarse a una sede específica o quedar sin sede (todas).
      </p>

      {locations.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">No hay sedes cargadas — se creará una al dar de alta profesionales.</p>
      ) : (
        <ul className="mb-4 divide-y divide-slate-100 text-sm">
          {locations.map((loc) => (
            <li key={loc.id} className="py-3">
              {editingId === loc.id ? (
                <form onSubmit={(e) => handleUpdate(loc.id, e)} className="grid gap-3 sm:grid-cols-2">
                  <Input name="name" label="Nombre" defaultValue={loc.name} required />
                  <Input name="phone" label="Teléfono" defaultValue={loc.phone ?? ""} />
                  <Input
                    name="address"
                    label="Dirección"
                    defaultValue={loc.address ?? ""}
                    className="sm:col-span-2"
                  />
                  <div className="flex gap-2 sm:col-span-2">
                    <Button type="submit" size="sm" loading={loading === loc.id}>
                      Guardar
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
                    <div>
                      <p className="font-medium text-slate-900">
                        {loc.name}
                        {loc.is_active === false ? (
                          <span className="ml-2 text-xs font-normal text-amber-700">(inactiva)</span>
                        ) : null}
                      </p>
                      {loc.address ? <p className="text-slate-600">{loc.address}</p> : null}
                      {loc.phone ? <p className="text-slate-500">{loc.phone}</p> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(loc.id)}
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={loading === loc.id}
                      onClick={() => handleToggleActive(loc.id, loc.is_active === false)}
                    >
                      {loc.is_active === false ? "Activar" : "Desactivar"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      loading={loading === loc.id}
                      onClick={() => handleDelete(loc.id, loc.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
        <Input name="name" label="Nueva sede — nombre" placeholder="Ej. Sede Norte" required />
        <Input name="phone" label="Teléfono (opcional)" placeholder="011 1234-5678" />
        <Input name="address" label="Dirección (opcional)" placeholder="Calle, número, localidad" />
        <div className="sm:col-span-2">
          <Button type="submit" loading={loading === "create"}>
            Agregar sede
          </Button>
        </div>
      </form>

      {err ? <p className="mt-3 text-sm text-red-700">{err}</p> : null}
      {msg ? <p className="mt-3 text-sm text-emerald-700">{msg}</p> : null}
    </Card>
  );
}
