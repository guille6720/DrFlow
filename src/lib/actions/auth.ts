"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setActiveClinic } from "@/lib/auth/session";
import { loginSchema, registerClinicSchema, setupClinicSchema } from "@/lib/validations/schemas";
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
  const raw = {
    clinicName: String(formData.get("clinicName") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    fullName: String(formData.get("fullName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    phone: String(formData.get("phone") ?? "").trim() || undefined,
  };

  const parsed = registerClinicSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return {
      error: "Hay errores en el formulario. Revisá los campos marcados en rojo.",
      fieldErrors,
    };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
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

  if (
    authData.user.identities &&
    authData.user.identities.length === 0
  ) {
    return {
      error: "Este email ya está registrado. Probá iniciar sesión.",
      fieldErrors: { email: "Ya existe una cuenta con este email." },
    };
  }

  if (!authData.session) {
    return {
      success: true,
      redirectTo: `/login?registered=pending&email=${encodeURIComponent(parsed.data.email)}`,
    };
  }

  await ensureProfile(
    supabase,
    authData.user.id,
    parsed.data.email,
    parsed.data.fullName
  );

  await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
    })
    .eq("id", authData.user.id);

  const { data: clinicId, error: setupError } = await supabase.rpc("setup_user_clinic", {
    p_name: parsed.data.clinicName,
    p_slug: parsed.data.slug,
    p_phone: parsed.data.phone ?? null,
  });

  if (setupError) {
    const msg = setupError.message ?? "";
    if (msg.includes("SLUG_TAKEN") || setupError.code === "23505") {
      return {
        error: "Ese identificador URL ya está en uso.",
        fieldErrors: { slug: "Este identificador URL ya existe. Elegí otro, ej: mi-clinica-2024" },
      };
    }
    if (msg.includes("setup_user_clinic") || msg.includes("function")) {
      return {
        error: "Ejecutá la migración 008 en Supabase SQL Editor antes de registrarte.",
      };
    }
    return {
      error: "No se pudo crear la clínica. Intentá con otro slug.",
      fieldErrors: { slug: msg },
    };
  }

  if (clinicId) {
    await setActiveClinic(clinicId as string);
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

  const raw = {
    clinicName: String(formData.get("clinicName") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    phone: String(formData.get("phone") ?? "").trim() || undefined,
  };

  const parsed = setupClinicSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "Revisá los campos marcados en rojo.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
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

  const { data: clinicId, error: setupError } = await supabase.rpc("setup_user_clinic", {
    p_name: parsed.data.clinicName,
    p_slug: parsed.data.slug,
    p_phone: parsed.data.phone ?? null,
  });

  if (setupError) {
    const msg = setupError.message ?? "";
    if (msg.includes("SLUG_TAKEN") || setupError.code === "23505") {
      return {
        error: "Ese identificador URL ya está en uso.",
        fieldErrors: { slug: "Probá otro slug, ej: drguille-consultorio" },
      };
    }
    if (msg.includes("NOT_AUTHENTICATED")) {
      return { error: "Tenés que iniciar sesión." };
    }
    if (msg.includes("ALREADY_HAS_CLINIC")) {
      return { success: true, redirectTo: "/dashboard" };
    }
    if (msg.includes("setup_user_clinic") || msg.includes("function")) {
      return {
        error:
          "Falta ejecutar la migración 008 en Supabase SQL Editor (supabase/migrations/008_clinic_setup_rpc.sql).",
      };
    }
    return {
      error: `No se pudo crear la clínica: ${msg}`,
    };
  }

  if (clinicId) {
    await setActiveClinic(clinicId as string);
  }

  return { success: true, redirectTo: "/dashboard" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
