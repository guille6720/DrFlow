"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { revalidatePamiPlanillaSurfaces } from "@/core/cache/revalidate-pami-planillas";
import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { nullToUndefined } from "@/core/supabase/json";
import { createClient } from "@/core/supabase/server";
import {
  PAMI_PLANILLA_FIELD_MULTILINE_MAX,
  PAMI_PLANILLA_FIELD_SINGLE_MAX,
  PAMI_PLANILLA_RENDERED_MAX,
} from "@/core/validations/pami-planilla";

import type { PamiPlanillaFieldDef } from "@/features/pami/types/pami-planilla-template";

export type PamiPlanillaAdminTemplate = {
  id: string;
  category: string;
  title: string;
  template: string;
  is_active_global: boolean;
  is_active_clinic: boolean;
  version_number: number;
  updated_at: string;
  fields: (PamiPlanillaFieldDef & { is_required?: boolean; sort_order?: number })[];
};

export type PamiPlanillaAdminCatalog = {
  categories: {
    id: string;
    label: string;
    description: string;
    is_active: boolean;
    sort_order: number;
  }[];
  templates: PamiPlanillaAdminTemplate[];
};

function mapAdminCatalog(payload: {
  categories?: PamiPlanillaAdminCatalog["categories"];
  templates?: PamiPlanillaAdminTemplate[];
} | null): PamiPlanillaAdminCatalog {
  return {
    categories: payload?.categories ?? [],
    templates: payload?.templates ?? [],
  };
}

export async function loadPamiPlanillaAdminCatalog(): Promise<{
  catalog?: PamiPlanillaAdminCatalog;
  error?: string;
}> {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) return { error: access.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_pami_planilla_admin_catalog", {
    p_clinic_id: access.clinicId,
  });

  if (error) {
    return {
      error: resolvePostgresUserMessage(error, {
        fallback: "No se pudo cargar el catálogo de planillas.",
      }),
    };
  }

  return { catalog: mapAdminCatalog(data as PamiPlanillaAdminCatalog) };
}

function validatePublishInput(body: string, fields: PamiPlanillaFieldDef[]): string | null {
  if (!body.trim()) return "El cuerpo de la plantilla no puede estar vacío.";
  if (body.length > PAMI_PLANILLA_RENDERED_MAX) {
    return `El cuerpo supera ${PAMI_PLANILLA_RENDERED_MAX} caracteres.`;
  }

  for (const field of fields) {
    if (!/^[a-z][a-z0-9_]*$/.test(field.key)) {
      return `Clave de campo inválida: ${field.key}`;
    }
    if (!field.label.trim()) return "Cada campo debe tener etiqueta.";
    const max = field.multiline ? PAMI_PLANILLA_FIELD_MULTILINE_MAX : PAMI_PLANILLA_FIELD_SINGLE_MAX;
    if ((field.placeholder?.length ?? 0) > max) {
      return `Placeholder demasiado largo en ${field.key}.`;
    }
  }

  const keys = new Set<string>();
  for (const field of fields) {
    if (keys.has(field.key)) return `Clave duplicada: ${field.key}`;
    keys.add(field.key);
  }

  return null;
}

export async function publishPamiPlanillaTemplate(input: {
  templateSlug: string;
  bodyTemplate: string;
  fields: PamiPlanillaFieldDef[];
  changeNotes?: string;
}): Promise<{ success?: boolean; versionNumber?: number; error?: string }> {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) return { error: access.error };

  const validationError = validatePublishInput(input.bodyTemplate, input.fields);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_pami_planilla_version", {
    p_template_slug: input.templateSlug,
    p_body_template: input.bodyTemplate.trim(),
    p_fields: input.fields.map((f, index) => ({
      key: f.key,
      label: f.label.trim(),
      multiline: f.multiline ?? false,
      placeholder: f.placeholder?.trim() || null,
      is_required: false,
      sort_order: index + 1,
    })),
    p_change_notes: nullToUndefined(input.changeNotes?.trim() || null),
    p_clinic_id: access.clinicId,
  });

  if (error) {
    return {
      error: resolvePostgresUserMessage(error, {
        fallback: "No se pudo publicar la nueva versión.",
      }),
    };
  }

  revalidatePamiPlanillaSurfaces(access.clinicId);
  revalidatePath("/configuracion");

  const row = data as { version_number?: number };
  return { success: true, versionNumber: row.version_number };
}

export async function setPamiPlanillaClinicActive(
  templateSlug: string,
  isActive: boolean
): Promise<{ success?: boolean; error?: string }> {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) return { error: access.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_pami_planilla_clinic_template_active", {
    p_clinic_id: access.clinicId,
    p_template_slug: templateSlug,
    p_is_active: isActive,
  });

  if (error) {
    return {
      error: resolvePostgresUserMessage(error, {
        fallback: "No se pudo actualizar el estado de la plantilla.",
      }),
    };
  }

  revalidatePamiPlanillaSurfaces(access.clinicId);
  revalidatePath("/configuracion");
  return { success: true };
}
