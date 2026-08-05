import { NextResponse } from "next/server";

import { requireSameOriginMutation } from "@/core/security/csrf";
import { createClient } from "@/core/supabase/server";

import { runPostLoginBootstrap } from "@/lib/auth/post-login-bootstrap";

export const dynamic = "force-dynamic";

/** Completes profile + invitations after client-side sign-in (PWA). */
export async function POST(request: Request) {
  const csrfBlock = requireSameOriginMutation(request);
  if (csrfBlock) return csrfBlock;

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await runPostLoginBootstrap(supabase, user);

  return NextResponse.json({ ok: true });
}
