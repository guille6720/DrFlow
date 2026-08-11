import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSettingsAccess } from "@/core/actions/clinic-guard";
import { getDashboardShell } from "@/core/auth/session.server";
import { createCheckoutPreference, isMercadoPagoConfigured } from "@/core/billing/mercadopago";
import {
  type BillingCycle,
  type BillingPlanId,
  getBillingPlan,
  getPlanPriceArs,
  isPlanAvailableForPurchase,
} from "@/core/billing/plans";
import { logServerError } from "@/core/errors/log-error.server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  planId: z.enum(["solo", "consultorio", "clinica"]),
  cycle: z.enum(["monthly", "annual"]).default("monthly"),
});

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(request: Request) {
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json(
      { error: "Mercado Pago no configurado." },
      { status: 503, headers: NO_STORE }
    );
  }

  const access = await requireSettingsAccess();
  if (access.error || !access.clinicId) {
    return NextResponse.json({ error: access.error ?? "Sin permisos." }, { status: 403, headers: NO_STORE });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers: NO_STORE });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "planId o cycle inválidos." }, { status: 400, headers: NO_STORE });
  }

  const { planId, cycle } = parsed.data as { planId: BillingPlanId; cycle: BillingCycle };
  const plan = getBillingPlan(planId);
  if (!plan || !isPlanAvailableForPurchase(plan) || getPlanPriceArs(planId, cycle) == null) {
    return NextResponse.json({ error: "Plan no disponible." }, { status: 400, headers: NO_STORE });
  }

  try {
    const { clinic, profile } = await getDashboardShell();
    const result = await createCheckoutPreference({
      clinicId: access.clinicId,
      clinicName: clinic?.name?.trim() || "Consultorio DrFlow",
      planId,
      cycle,
      payerEmail: profile?.email,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502, headers: NO_STORE });
    }

    return NextResponse.json(
      { preferenceId: result.preferenceId, initPoint: result.initPoint },
      { headers: NO_STORE }
    );
  } catch (err) {
    logServerError("api.billing.create-preference", err);
    return NextResponse.json({ error: "Error al crear checkout." }, { status: 500, headers: NO_STORE });
  }
}
