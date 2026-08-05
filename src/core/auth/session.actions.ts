"use server";

import { cookies } from "next/headers";

import { getUserClinics } from "@/core/auth/session";
import {
  recordAudit,
  type RecordAuditParams,
} from "@/core/security/audit-service";

const CLINIC_COOKIE = "drflow_clinic_id";

export async function setActiveClinic(clinicId: string) {
  const cookieStore = await cookies();
  const clinics = await getUserClinics();
  if (!clinics.some((c) => c.clinic_id === clinicId)) {
    throw new Error("No tenés acceso a esta clínica");
  }
  cookieStore.set(CLINIC_COOKIE, clinicId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function logAudit(params: Omit<RecordAuditParams, "userId">) {
  await recordAudit(params);
}
