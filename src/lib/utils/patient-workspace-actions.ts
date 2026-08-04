import {
  DEFAULT_PATIENT_WORKSPACE_TAB,
  type PatientWorkspaceTabId,
} from "@/lib/constants/patient-workspace-tabs";

export type PatientWorkspaceAction = "nueva" | "upload" | "alta" | "certificado";
export type PatientWorkspaceMode = "edit" | "view";

export type PatientWorkspaceUrlOptions = {
  tab?: PatientWorkspaceTabId;
  action?: PatientWorkspaceAction;
  record?: string;
  mode?: PatientWorkspaceMode;
  appointment?: string;
  professional?: string;
  consulta?: string;
};

/** Build a patient workspace URL with optional sheet/query state. */
export function buildPatientWorkspaceUrl(
  patientId: string,
  opts: PatientWorkspaceUrlOptions = {}
): string {
  const tab = opts.tab ?? DEFAULT_PATIENT_WORKSPACE_TAB;
  const params = new URLSearchParams();

  const hasSheetState =
    opts.action != null ||
    opts.record != null ||
    opts.mode != null ||
    opts.appointment != null ||
    opts.professional != null ||
    opts.consulta != null;

  if (tab !== DEFAULT_PATIENT_WORKSPACE_TAB || hasSheetState) {
    params.set("tab", tab);
  }
  if (opts.action) params.set("action", opts.action);
  if (opts.record) params.set("record", opts.record);
  if (opts.mode) params.set("mode", opts.mode);
  if (opts.appointment) params.set("appointment", opts.appointment);
  if (opts.professional) params.set("professional", opts.professional);
  if (opts.consulta) params.set("consulta", opts.consulta);

  const qs = params.toString();
  return qs ? `/pacientes/${patientId}?${qs}` : `/pacientes/${patientId}`;
}

export type ParsedPatientWorkspaceActions = {
  action: PatientWorkspaceAction | null;
  record: string | null;
  mode: PatientWorkspaceMode | null;
  appointment: string | null;
  professional: string | null;
  consulta: string | null;
  consultSheetOpen: boolean;
  prescriptionSheetOpen: boolean;
  orderSheetOpen: boolean;
  recordSheetOpen: boolean;
  dischargeSheetOpen: boolean;
  certificateSheetOpen: boolean;
};

export function parsePatientWorkspaceActions(
  tab: PatientWorkspaceTabId,
  searchParams: URLSearchParams
): ParsedPatientWorkspaceActions {
  const action = searchParams.get("action") as PatientWorkspaceAction | null;
  const record = searchParams.get("record");
  const mode = searchParams.get("mode") as PatientWorkspaceMode | null;
  const appointment = searchParams.get("appointment");
  const professional = searchParams.get("professional");
  const consulta = searchParams.get("consulta");

  return {
    action,
    record,
    mode,
    appointment,
    professional,
    consulta,
    consultSheetOpen: action === "nueva" && tab === "soap",
    prescriptionSheetOpen: action === "nueva" && tab === "recetas",
    orderSheetOpen: action === "nueva" && tab === "ordenes",
    recordSheetOpen: Boolean(record && tab === "soap" && action !== "nueva"),
    dischargeSheetOpen: action === "alta",
    certificateSheetOpen: action === "certificado",
  };
}
