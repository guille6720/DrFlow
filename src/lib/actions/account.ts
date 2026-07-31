"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { purgeSoleOwnerClinicsForUser } from "@/lib/actions/clinic-purge";
import { DELETE_ACCOUNT_CONFIRM_PHRASE } from "@/lib/constants/account";
import { createClient } from "@/lib/supabase/server";

const CLINIC_COOKIE = "drflow_clinic_id";

export async function deleteMyAccount(confirmPhrase: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sesión requerida" };
  }

  if (confirmPhrase.trim() !== DELETE_ACCOUNT_CONFIRM_PHRASE) {
    return {
      error: `Escribí exactamente «${DELETE_ACCOUNT_CONFIRM_PHRASE}» para confirmar.`,
    };
  }

  const purge = await purgeSoleOwnerClinicsForUser(user.id);
  if (purge.error) {
    return { error: purge.error };
  }

  const { error } = await supabase.rpc("delete_own_account", {
    p_confirm_phrase: confirmPhrase.trim(),
  });

  if (error) {
    if (error.message.includes("delete_own_account")) {
      return {
        error:
          "Ejecutá la migración 039 en Supabase SQL Editor (delete_own_account) y volvé a intentar.",
      };
    }
    return { error: error.message };
  }

  const cookieStore = await cookies();
  cookieStore.delete(CLINIC_COOKIE);

  await supabase.auth.signOut();
  redirect("/?cuenta=eliminada");
}
