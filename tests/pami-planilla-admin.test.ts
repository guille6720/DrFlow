import { describe, expect, it, vi } from "vitest";

vi.mock("@/core/actions/clinic-guard", () => ({
  requireClinicPermission: vi.fn(async () => ({
    ok: true as const,
    clinicId: "clinic-1",
    user: { id: "user-1" },
    role: "clinic_admin",
  })),
}));

vi.mock("@/core/cache/revalidate-pami-planillas", () => ({
  revalidatePamiPlanillaSurfaces: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const rpc = vi.fn();

vi.mock("@/core/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc })),
}));

import {
  loadPamiPlanillaAdminCatalog,
  publishPamiPlanillaTemplate,
  setPamiPlanillaClinicActive,
} from "@/lib/actions/pami-planilla-admin";

describe("pami-planilla-admin actions", () => {
  it("loads admin catalog via RPC", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        categories: [{ id: "insumos", label: "Insumos", description: "", is_active: true, sort_order: 1 }],
        templates: [
          {
            id: "insumos-panales",
            category: "insumos",
            title: "Pañales",
            template: "Hola",
            is_active_global: true,
            is_active_clinic: true,
            version_number: 1,
            updated_at: "2026-01-01",
            fields: [],
          },
        ],
      },
      error: null,
    });

    const result = await loadPamiPlanillaAdminCatalog();
    expect(result.catalog?.templates).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("get_pami_planilla_admin_catalog", {
      p_clinic_id: "clinic-1",
    });
  });

  it("publishes a new template version", async () => {
    rpc.mockResolvedValueOnce({ data: { version_number: 2 }, error: null });

    const result = await publishPamiPlanillaTemplate({
      templateSlug: "id-inicial",
      bodyTemplate: "Nuevo cuerpo {{motivo}}",
      fields: [{ key: "motivo", label: "Motivo", multiline: true }],
      changeNotes: "Ajuste normativo",
    });

    expect(result.success).toBe(true);
    expect(result.versionNumber).toBe(2);
    expect(rpc).toHaveBeenCalledWith(
      "publish_pami_planilla_version",
      expect.objectContaining({
        p_template_slug: "id-inicial",
        p_clinic_id: "clinic-1",
      })
    );
  });

  it("rejects invalid field keys", async () => {
    const result = await publishPamiPlanillaTemplate({
      templateSlug: "id-inicial",
      bodyTemplate: "Texto",
      fields: [{ key: "Motivo-Invalido", label: "Motivo" }],
    });
    expect(result.error).toMatch(/Clave de campo inválida/);
  });

  it("toggles clinic template active state", async () => {
    rpc.mockResolvedValueOnce({ data: {}, error: null });

    const result = await setPamiPlanillaClinicActive("oxigeno", false);
    expect(result.success).toBe(true);
    expect(rpc).toHaveBeenCalledWith("set_pami_planilla_clinic_template_active", {
      p_clinic_id: "clinic-1",
      p_template_slug: "oxigeno",
      p_is_active: false,
    });
  });
});
