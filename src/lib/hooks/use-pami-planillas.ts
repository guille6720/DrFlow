"use client";

import { type SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";

import { copyTextToClipboard } from "@/core/browser/copy-to-clipboard";
import { printTextDocument } from "@/core/browser/print-text-document";
import { useAppRouterRefresh } from "@/core/hooks/use-app-router-refresh";
import { toast } from "@/core/notifications/toast";
import {
  clampPamiPlanillaValues,
  validatePamiPlanillaForExport,
} from "@/core/validations/pami-planilla";

import { getPamiMessages } from "@/features/pami/i18n";
import {
  getDefaultPlanillaCategory,
  getDefaultPlanillaTemplateId,
} from "@/features/pami/services/pami-planilla-templates.service";
import type {
  PamiPlanillaPatient,
  PamiPlanillaProfessional,
} from "@/features/pami/types/pami-planilla-entities";
import type {
  PamiPlanillaCatalog,
  PamiPlanillaCategory,
  PamiPlanillaTemplate,
} from "@/features/pami/types/pami-planilla-template";
import { renderPamiPlanilla } from "@/features/pami/utils/render-pami-planilla";
import { createMedicalOrder } from "@/features/recetas/actions/medical-orders";
import { createMedicalOrderIdempotencyKey } from "@/features/recetas/utils/medical-order-idempotency";

import { getProfessionalDisplayName } from "@/lib/utils/professional";

export function usePamiPlanillas(
  patients: PamiPlanillaPatient[],
  professionals: PamiPlanillaProfessional[],
  catalog: PamiPlanillaCatalog,
  defaultProfessionalId?: string
) {
  const { refreshSafely } = useAppRouterRefresh();
  const initialCategory = getDefaultPlanillaCategory(catalog);
  const [category, setCategory] = useState<PamiPlanillaCategory>(initialCategory);
  const [templateId, setTemplateId] = useState(
    getDefaultPlanillaTemplateId(catalog, initialCategory)
  );
  const [patientId, setPatientId] = useState("");
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Synchronous guard — blocks double-click before React re-renders loading. */
  const saveInFlightRef = useRef(false);
  /** Reused on retry; reset when the planilla content changes or after success. */
  const idempotencyKeyRef = useRef<string | null>(null);

  const categoryTemplates = useMemo(
    () => catalog.templates.filter((t) => t.category === category),
    [catalog.templates, category]
  );

  const template: PamiPlanillaTemplate | undefined =
    categoryTemplates.find((t) => t.id === templateId) ?? categoryTemplates[0];

  const patient = patients.find((p) => p.id === patientId);
  const professional = professionals.find((p) => p.id === professionalId);

  const rendered = useMemo(() => {
    if (!template || !patient || !professional) return "";
    return renderPamiPlanilla(template, values, {
      patientName: `${patient.last_name}, ${patient.first_name}`,
      patientDni: patient.document_number,
      patientPami: patient.insurance_number ?? "",
      professionalName: getProfessionalDisplayName(professional),
      licenseNumber: professional.license_number ?? "",
      patientAddress: patient.address ?? undefined,
    });
  }, [template, values, patient, professional]);

  const planillaFingerprint = useMemo(
    () =>
      JSON.stringify({
        category,
        templateId,
        patientId,
        professionalId,
        values,
        rendered,
      }),
    [category, templateId, patientId, professionalId, values, rendered]
  );

  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [planillaFingerprint]);

  function selectCategory(id: PamiPlanillaCategory) {
    setCategory(id);
    const first = catalog.templates.find((t) => t.category === id);
    if (first) {
      setTemplateId(first.id);
      setValues({});
    }
  }

  function setPlanillaValues(updater: React.SetStateAction<Record<string, string>>) {
    setValues((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!template) return next;
      return clampPamiPlanillaValues(template, { ...prev, ...next });
    });
  }

  const t = getPamiMessages().planillas.actions;

  function assertPlanillaExportable(): boolean {
    if (!template || !patient || !professional || !rendered) {
      setError(t.exportIncomplete);
      return false;
    }

    const validation = validatePamiPlanillaForExport(template, values, rendered);
    if (!validation.ok) {
      setError(validation.error);
      return false;
    }

    return true;
  }

  async function copyText() {
    if (!rendered) return;

    setError(null);
    if (!assertPlanillaExportable()) return;

    try {
      const result = await copyTextToClipboard(rendered);
      if (result.ok) {
        toast.copySuccess();
        return;
      }
      setError(result.message);
    } catch {
      setError(t.copyFailed);
    }
  }

  function printText() {
    if (!rendered) return;

    setError(null);
    if (!assertPlanillaExportable()) return;

    try {
      const result = printTextDocument({
        text: rendered,
        title: template?.title ?? t.printTitleFallback,
      });
      if (!result.ok) {
        setError(result.message);
      }
    } catch {
      setError(t.printFailed);
    }
  }

  async function saveAsOrder(event?: Pick<SyntheticEvent, "preventDefault" | "stopPropagation">) {
    event?.preventDefault();
    event?.stopPropagation();

    if (saveInFlightRef.current || loading) return;

    saveInFlightRef.current = true;
    setError(null);

    if (!assertPlanillaExportable()) {
      saveInFlightRef.current = false;
      return;
    }

    if (!patient || !professional || !rendered || !template) {
      saveInFlightRef.current = false;
      return;
    }

    setLoading(true);

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = createMedicalOrderIdempotencyKey();
    }

    try {
      const fd = new FormData();
      fd.set("patient_id", patient.id);
      fd.set("professional_id", professional.id);
      fd.set("order_text", rendered);
      fd.set("order_type", "pami_form");
      fd.set("notes", template.title ?? t.orderNotesFallback);
      fd.set("idempotency_key", idempotencyKeyRef.current);

      const result = await createMedicalOrder(fd);
      if (result.error) {
        setError(result.error);
        return;
      }

      idempotencyKeyRef.current = null;
      toast.success(t.saveSuccessToast);

      const refreshResult = await refreshSafely({
        scope: "pami-planillas.refresh-after-save",
        metadata: {
          patientId: patient.id,
          professionalId: professional.id,
          templateId: template.id,
          orderType: "pami_form",
        },
      });

      if (!refreshResult.ok) {
        setError(refreshResult.message);
      }
    } catch {
      setError(t.saveFailed);
    } finally {
      saveInFlightRef.current = false;
      setLoading(false);
    }
  }

  /** Blocks duplicate pointer / keyboard activation while a save is in flight. */
  function handleSaveAsOrder(event?: Pick<SyntheticEvent, "preventDefault" | "stopPropagation">) {
    if (saveInFlightRef.current || loading) {
      event?.preventDefault();
      event?.stopPropagation();
      return;
    }
    void saveAsOrder(event);
  }

  return {
    category,
    selectCategory,
    template,
    categoryTemplates,
    templateId,
    setTemplateId,
    setValues: setPlanillaValues,
    patientId,
    setPatientId,
    professionalId,
    setProfessionalId,
    values,
    rendered,
    loading,
    error,
    copyText,
    printText,
    saveAsOrder,
    handleSaveAsOrder,
  };}

export type { PamiPlanillaPatient, PamiPlanillaProfessional };
