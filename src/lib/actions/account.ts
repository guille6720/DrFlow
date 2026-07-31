"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DELETE_ACCOUNT_CONFIRM_PHRASE } from "@/lib/constants/account";

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

  await supabase.auth.signOut();
  redirect("/register?cuenta=eliminada");
}
