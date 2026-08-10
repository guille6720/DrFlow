"use server";

import { cookies } from "next/headers";

import { getUserClinics } from "@/core/auth/session";
import {
  recordAudit,
  type RecordAuditParams,
} from "@/core/security/audit-service";

const CLINIC_COOKIE = "drflow_clinic_id";

const CLINIC_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
};

/** Sets active clinic cookie without membership re-validation (post-setup). */
export async function setActiveClinicCookie(clinicId: string) {
  const cookieStore = await cookies();
  cookieStore.set(CLINIC_COOKIE, clinicId, CLINIC_COOKIE_OPTIONS);
}

export async function setActiveClinic(clinicId: string) {
  const cookieStore = await cookies();
  const clinics = await getUserClinics();
  if (!clinics.some((c) => c.clinic_id === clinicId)) {
    throw new Error("No tenés acceso a esta clínica");
  }
  cookieStore.set(CLINIC_COOKIE, clinicId, CLINIC_COOKIE_OPTIONS);
}

export async function logAudit(params: Omit<RecordAuditParams, "userId">) {
  await recordAudit(params);
}
