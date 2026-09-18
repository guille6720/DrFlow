/**
 * Phase 20 — Argentine tax invoicing posture (ARCA).
 * Mercado Pago receipts are NOT fiscal invoices.
 * Do not emit fake CAE / comprobantes. Future official integration plugs here.
 * Not legal or accounting advice — REQUIERE CONTADOR.
 */

export const TAX_INVOICING_REQUIERE_CONTADOR = "REQUIERE_CONTADOR" as const;

export type TaxInvoicingScope =
  /** NexClinic SaaS seller → clinic customer (subscription monetization). */
  | "saas_seller_to_clinic"
  /** Clinic cash register → patient (product feature; not SaaS ARCA). */
  | "clinic_cash_to_patient";

export type AccountantPrerequisite = {
  id: string;
  label: string;
  description: string;
  status: typeof TAX_INVOICING_REQUIERE_CONTADOR;
};

/** Determinations required before legal commercial invoicing of SaaS. */
export const SAAS_TAX_ACCOUNTANT_PREREQUISITES: AccountantPrerequisite[] = [
  {
    id: "legal_seller",
    label: "Vendedor legal",
    description: "Persona humana o jurídica que factura el SaaS NexClinic.",
    status: TAX_INVOICING_REQUIERE_CONTADOR,
  },
  {
    id: "cuit",
    label: "CUIT del vendedor",
    description: "CUIT/CUIL del emisor fiscal.",
    status: TAX_INVOICING_REQUIERE_CONTADOR,
  },
  {
    id: "arca_tax_status",
    label: "Condición ante ARCA",
    description: "Monotributo, Responsable Inscripto, exento u otra categoría.",
    status: TAX_INVOICING_REQUIERE_CONTADOR,
  },
  {
    id: "economic_activity",
    label: "Actividad económica declarada",
    description: "Código de actividad AFIP/ARCA aplicable a software/SaaS.",
    status: TAX_INVOICING_REQUIERE_CONTADOR,
  },
  {
    id: "electronic_invoicing",
    label: "Facturación electrónica",
    description: "Punto de venta, tipos A/B/C/E y circuito de autorización (CAE/CAEA).",
    status: TAX_INVOICING_REQUIERE_CONTADOR,
  },
  {
    id: "vat_treatment",
    label: "Tratamiento de IVA",
    description: "Alícuota, exenciones y leyendas según condición del cliente.",
    status: TAX_INVOICING_REQUIERE_CONTADOR,
  },
  {
    id: "gross_income_tax",
    label: "Ingresos Brutos provinciales",
    description: "Inscripción y alícuotas provinciales aplicables a la operación.",
    status: TAX_INVOICING_REQUIERE_CONTADOR,
  },
  {
    id: "convenio_multilateral",
    label: "Convenio Multilateral",
    description: "Si la actividad se desarrolla en más de una jurisdicción.",
    status: TAX_INVOICING_REQUIERE_CONTADOR,
  },
];

export type FiscalInvoiceIssueRequest = {
  scope: TaxInvoicingScope;
  clinicId: string;
  /** Mercado Pago payment id, cash charge id, or other source key. */
  sourcePaymentId: string;
  amountCents: number;
  currency: "ARS";
  buyerEmail?: string | null;
  planId?: string | null;
  billingCycle?: string | null;
};

/**
 * Result of attempting fiscal issuance.
 * Real ARCA adapters may add `issued` later — never invent CAE here.
 */
export type FiscalInvoiceIssueResult =
  | {
      status: "deferred_external";
      reason: typeof TAX_INVOICING_REQUIERE_CONTADOR;
      providerId: "none";
      mercadoPagoIsFiscalInvoice: false;
      message: string;
    }
  | {
      status: "unsupported_scope";
      reason: typeof TAX_INVOICING_REQUIERE_CONTADOR;
      providerId: "none";
      message: string;
    };

export interface FiscalInvoicingProvider {
  readonly id: string;
  readonly implementsOfficialArca: false | true;
  issue(request: FiscalInvoiceIssueRequest): Promise<FiscalInvoiceIssueResult>;
}

/**
 * Default provider: intentionally does NOT call ARCA or mint fake invoices.
 * Swap for an official adapter after accountant + legal setup.
 */
export class DeferredExternalFiscalInvoicingProvider implements FiscalInvoicingProvider {
  readonly id = "deferred_external_arca";
  readonly implementsOfficialArca = false as const;

  async issue(request: FiscalInvoiceIssueRequest): Promise<FiscalInvoiceIssueResult> {
    if (request.scope !== "saas_seller_to_clinic") {
      return {
        status: "unsupported_scope",
        reason: TAX_INVOICING_REQUIERE_CONTADOR,
        providerId: "none",
        message:
          "Facturación fiscal de caja clínica (clinic→paciente) es un circuito distinto; no es emisión ARCA del SaaS.",
      };
    }

    return {
      status: "deferred_external",
      reason: TAX_INVOICING_REQUIERE_CONTADOR,
      providerId: "none",
      mercadoPagoIsFiscalInvoice: false,
      message:
        "Comprobante Mercado Pago ≠ factura fiscal. Emisión ARCA pendiente de contador y proveedor oficial.",
    };
  }
}

let defaultProvider: FiscalInvoicingProvider = new DeferredExternalFiscalInvoicingProvider();

export function getSaasFiscalInvoicingProvider(): FiscalInvoicingProvider {
  return defaultProvider;
}

/** Test / future DI hook — production default remains deferred external. */
export function setSaasFiscalInvoicingProviderForTests(provider: FiscalInvoicingProvider): void {
  defaultProvider = provider;
}

export function resetSaasFiscalInvoicingProvider(): void {
  defaultProvider = new DeferredExternalFiscalInvoicingProvider();
}

export function assertMercadoPagoReceiptIsNotFiscalInvoice(): {
  isFiscalInvoice: false;
  classification: "payment_receipt_only";
  fiscalAction: typeof TAX_INVOICING_REQUIERE_CONTADOR;
} {
  return {
    isFiscalInvoice: false,
    classification: "payment_receipt_only",
    fiscalAction: TAX_INVOICING_REQUIERE_CONTADOR,
  };
}

/** Audit-friendly payload after SaaS payment activation (no fake CAE). */
export async function buildSaasFiscalInvoiceAuditMetadata(input: {
  clinicId: string;
  mercadoPagoPaymentId: string;
  amountCents: number;
  planId?: string | null;
  billingCycle?: string | null;
  buyerEmail?: string | null;
}): Promise<Record<string, unknown>> {
  const mp = assertMercadoPagoReceiptIsNotFiscalInvoice();
  const result = await getSaasFiscalInvoicingProvider().issue({
    scope: "saas_seller_to_clinic",
    clinicId: input.clinicId,
    sourcePaymentId: input.mercadoPagoPaymentId,
    amountCents: input.amountCents,
    currency: "ARS",
    buyerEmail: input.buyerEmail,
    planId: input.planId,
    billingCycle: input.billingCycle,
  });

  return {
    mercadoPagoReceipt: mp,
    fiscalIssuance: result,
    prerequisitesPending: SAAS_TAX_ACCOUNTANT_PREREQUISITES.map((p) => p.id),
  };
}

export type FutureFiscalSchemaExtension = {
  table: string;
  purpose: string;
  suggestedColumns: string[];
};

/** Documented extension points — not created as migrations in this phase. */
export const FUTURE_FISCAL_SCHEMA_EXTENSIONS: FutureFiscalSchemaExtension[] = [
  {
    table: "saas_fiscal_invoice_requests",
    purpose: "Cola de emisión fiscal SaaS ligada a clinic_subscription_payments",
    suggestedColumns: [
      "id",
      "clinic_id",
      "subscription_payment_id",
      "mercado_pago_payment_id",
      "amount_cents",
      "currency",
      "status",
      "provider",
      "arca_cae",
      "comprobante_tipo",
      "punto_venta",
      "issued_at",
      "raw_provider_response",
    ],
  },
];

export type TaxInvoicingPosture = {
  mercadoPagoReplacesFiscalInvoice: false;
  officialArcaImplemented: false;
  fakeInvoicingForbidden: true;
  prerequisiteCount: number;
  allPrerequisitesRequireAccountant: true;
  extensionPointReady: true;
  notes: string[];
};

export function evaluateTaxInvoicingPosture(): TaxInvoicingPosture {
  return {
    mercadoPagoReplacesFiscalInvoice: false,
    officialArcaImplemented: false,
    fakeInvoicingForbidden: true,
    prerequisiteCount: SAAS_TAX_ACCOUNTANT_PREREQUISITES.length,
    allPrerequisitesRequireAccountant: true,
    extensionPointReady: true,
    notes: [
      "Provider por defecto: DeferredExternalFiscalInvoicingProvider (sin CAE falso).",
      "cash_invoices (caja) es draft clinic→paciente, no factura ARCA del vendedor SaaS.",
      "Integración oficial futura: implementar FiscalInvoicingProvider y registrar en DI.",
    ],
  };
}
