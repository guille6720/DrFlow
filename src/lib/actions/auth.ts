"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setActiveClinic } from "@/lib/auth/session";
import { loginSchema, registerClinicSchema, setupClinicSchema } from "@/lib/validations/schemas";
import {
  parseDoctorSetupFromForm,
  validateDoctorSetup,
} from "@/lib/validations/doctor-setup";
import { zodFieldErrors } from "@/lib/validations/form-errors";

export type AuthActionResult = {
  success?: boolean;
  redirectTo?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  needsEmailConfirmation?: boolean;
  message?: string;
};

function mapAuthError(message: string): { error: string; field?: string } {
  const lower = message.toLowerCase();
  if (lower.includes("email not confirmed") || lower.includes("confirm")) {
    return {
      error:
        "Debés confirmar tu email antes de ingresar. Revisá tu bandeja (y spam), o desactivá 'Confirm email' en Supabase → Authentication → Email.",
      field: "email",
    };
  }
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return { error: "Email o contraseña incorrectos.", field: "password" };
  }
  if (
    lower.includes("already registered") ||
    lower.includes("already exists") ||
    lower.includes("user already")
  ) {
    return {
      error: "Este email ya está registrado. Probá iniciar sesión.",
      field: "email",
    };
  }
  if (lower.includes("password") && lower.includes("weak")) {
    return { error: "La contraseña es muy débil. Usá al menos 8 caracteres.", field: "password" };
  }
  if (lower.includes("rate limit")) {
    return { error: "Demasiados intentos. Esperá unos minutos." };
  }
  return { error: message };
}

function mapSetupRpcError(message: string): AuthActionResult {
  if (message.includes("SLUG_TAKEN") || message.includes("23505")) {
    return {
      error: "Ese identificador URL ya está en uso.",
      fieldErrors: { slug: "Probá otro slug, ej: drguille-consultorio" },
    };
  }
  if (message.includes("NOT_AUTHENTICATED")) {
    return { error: "Tenés que iniciar sesión." };
  }
  if (message.includes("ALREADY_HAS_CLINIC")) {
    return { success: true, redirectTo: "/dashboard" };
  }
  if (message.includes("PHONE_REQUIRED")) {
    return {
      error: "El teléfono es obligatorio.",
      fieldErrors: { phone: "Ingresá un teléfono para solicitud de turnos" },
    };
  }
  if (message.includes("LICENSE_REQUIRED")) {
    return {
      error: "La matrícula es obligatoria.",
      fieldErrors: { licenseNational: "Ingresá la matrícula nacional" },
    };
  }
  if (message.includes("setup_user_clinic") || message.includes("function")) {
    return {
      error:
        "Falta ejecutar la migración 024 en Supabase SQL Editor (supabase/migrations/024_doctor_onboarding_fields.sql).",
    };
  }
  return { error: `No se pudo crear la clínica: ${message}` };
}

function parseClinicAndDoctor(formData: FormData) {
  const clinicParsed = setupClinicSchema.safeParse({
    clinicName: String(formData.get("clinicName") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
  });

  if (!clinicParsed.success) {
    return { fieldErrors: zodFieldErrors(clinicParsed.error) };
  }

  const doctorResult = validateDoctorSetup(parseDoctorSetupFromForm(formData));
  if (doctorResult.fieldErrors) {
    return { fieldErrors: doctorResult.fieldErrors };
  }
  if (doctorResult.error) {
    return { fieldErrors: zodFieldErrors(doctorResult.error) };
  }
  if (!doctorResult.data) {
    return { error: "Datos del médico incompletos." };
  }

  return { clinic: clinicParsed.data, doctor: doctorResult.data };
}

async function runSetupUserClinic(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData
): Promise<{ clinicId?: string; error?: AuthActionResult }> {
  const parsed = parseClinicAndDoctor(formData);
  if ("fieldErrors" in parsed && parsed.fieldErrors) {
    return {
      error: { error: "Revisá los campos marcados en rojo.", fieldErrors: parsed.fieldErrors },
    };
  }
  if ("error" in parsed && parsed.error) {
    return { error: { error: parsed.error } };
  }

  const { clinic, doctor } = parsed as {
    clinic: { clinicName: string; slug: string };
    doctor: NonNullable<ReturnType<typeof validateDoctorSetup>["data"]>;
  };

  const { data: clinicId, error: setupError } = await supabase.rpc("setup_user_clinic", {
    p_name: clinic.clinicName,
    p_slug: clinic.slug,
    p_phone: doctor.phone,
    p_doctor_first_name: doctor.doctorFirstName,
    p_doctor_last_name: doctor.doctorLastName,
    p_document_number: doctor.documentNumber,
    p_specialty: doctor.specialty,
    p_license_national: doctor.licenseNational,
    p_license_provincial: doctor.licenseProvincial,
  });

  if (setupError) {
    return { error: mapSetupRpcError(setupError.message ?? "") };
  }

  return { clinicId: clinicId as string | undefined };
}

async function ensureProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string,
  fullName?: string
) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("profiles").insert({
      id: userId,
      email,
      full_name: fullName ?? email.split("@")[0],
    });
  }
}

export async function signIn(formData: FormData): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return {
      error: "Revisá los campos marcados en rojo.",
      fieldErrors,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    const mapped = mapAuthError(error.message);
    return {
      error: mapped.error,
      fieldErrors: mapped.field ? { [mapped.field]: mapped.error } : undefined,
    };
  }

  if (!data.user) {
    return { error: "No se pudo iniciar sesión." };
  }

  await ensureProfile(
    supabase,
    data.user.id,
    data.user.email ?? parsed.data.email,
    data.user.user_metadata?.full_name
  );

  redirect("/dashboard");
}

export async function signUpClinic(formData: FormData): Promise<AuthActionResult> {
  const accountParsed = registerClinicSchema.safeParse({
    clinicName: String(formData.get("clinicName") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });

  if (!accountParsed.success) {
    return {
      error: "Hay errores en el formulario. Revisá los campos marcados en rojo.",
      fieldErrors: zodFieldErrors(accountParsed.error),
    };
  }

  const doctorCheck = validateDoctorSetup(parseDoctorSetupFromForm(formData));
  if (doctorCheck.fieldErrors) {
    return { error: "Revisá los datos del médico.", fieldErrors: doctorCheck.fieldErrors };
  }
  if (doctorCheck.error) {
    return { error: "Revisá los datos del médico.", fieldErrors: zodFieldErrors(doctorCheck.error) };
  }

  const fullName = `${doctorCheck.data!.doctorFirstName} ${doctorCheck.data!.doctorLastName}`;

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: accountParsed.data.email,
    password: accountParsed.data.password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (authError) {
    const mapped = mapAuthError(authError.message);
    return {
      error: mapped.error,
      fieldErrors: mapped.field ? { [mapped.field]: mapped.error } : undefined,
    };
  }

  if (!authData.user) {
    return { error: "No se pudo crear la cuenta. Intentá de nuevo." };
  }

  if (authData.user.identities && authData.user.identities.length === 0) {
    return {
      error: "Este email ya está registrado. Probá iniciar sesión.",
      fieldErrors: { email: "Ya existe una cuenta con este email." },
    };
  }

  if (!authData.session) {
    return {
      success: true,
      redirectTo: `/login?registered=pending&email=${encodeURIComponent(accountParsed.data.email)}`,
    };
  }

  await ensureProfile(supabase, authData.user.id, accountParsed.data.email, fullName);

  const setup = await runSetupUserClinic(supabase, formData);
  if (setup.error) return setup.error;

  if (setup.clinicId) {
    await setActiveClinic(setup.clinicId);
  }

  return { success: true, redirectTo: "/dashboard" };
}

export async function setupClinic(formData: FormData): Promise<AuthActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tenés que iniciar sesión." };
  }

  const { data: existingMember } = await supabase
    .from("clinic_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existingMember) {
    return { success: true, redirectTo: "/dashboard" };
  }

  await ensureProfile(
    supabase,
    user.id,
    user.email ?? "",
    user.user_metadata?.full_name as string | undefined
  );

  const setup = await runSetupUserClinic(supabase, formData);
  if (setup.error) return setup.error;

  if (setup.clinicId) {
    await setActiveClinic(setup.clinicId);
  }

  return { success: true, redirectTo: "/dashboard" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
