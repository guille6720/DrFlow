/**
 * Phase 20 — Tax invoicing / ARCA posture tests.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  assertMercadoPagoReceiptIsNotFiscalInvoice,
  buildSaasFiscalInvoiceAuditMetadata,
  evaluateTaxInvoicingPosture,
  FUTURE_FISCAL_SCHEMA_EXTENSIONS,
  getSaasFiscalInvoicingProvider,
  resetSaasFiscalInvoicingProvider,
  SAAS_TAX_ACCOUNTANT_PREREQUISITES,
  TAX_INVOICING_REQUIERE_CONTADOR,
} from "@/core/compliance/tax-invoicing-argentina";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

afterEach(() => {
  resetSaasFiscalInvoicingProvider();
});

describe("tax-invoicing-argentina policy", () => {
  it("catalogs accountant prerequisites as REQUIERE_CONTADOR", () => {
    expect(SAAS_TAX_ACCOUNTANT_PREREQUISITES.length).toBeGreaterThanOrEqual(8);
    expect(
      SAAS_TAX_ACCOUNTANT_PREREQUISITES.every((p) => p.status === TAX_INVOICING_REQUIERE_CONTADOR)
    ).toBe(true);
    expect(SAAS_TAX_ACCOUNTANT_PREREQUISITES.map((p) => p.id)).toEqual(
      expect.arrayContaining([
        "legal_seller",
        "cuit",
        "arca_tax_status",
        "economic_activity",
        "electronic_invoicing",
        "vat_treatment",
        "gross_income_tax",
        "convenio_multilateral",
      ])
    );
  });

  it("asserts Mercado Pago receipt is not a fiscal invoice", () => {
    const mp = assertMercadoPagoReceiptIsNotFiscalInvoice();
    expect(mp.isFiscalInvoice).toBe(false);
    expect(mp.classification).toBe("payment_receipt_only");
    expect(mp.fiscalAction).toBe(TAX_INVOICING_REQUIERE_CONTADOR);
  });

  it("default provider defers SaaS issuance without fake ARCA", async () => {
    const provider = getSaasFiscalInvoicingProvider();
    expect(provider.implementsOfficialArca).toBe(false);

    const result = await provider.issue({
      scope: "saas_seller_to_clinic",
      clinicId: "11111111-1111-1111-1111-111111111111",
      sourcePaymentId: "mp-1",
      amountCents: 2_490_000,
      currency: "ARS",
    });

    expect(result.status).toBe("deferred_external");
    if (result.status === "deferred_external") {
      expect(result.mercadoPagoIsFiscalInvoice).toBe(false);
      expect(result.reason).toBe(TAX_INVOICING_REQUIERE_CONTADOR);
      expect(result.providerId).toBe("none");
    }
  });

  it("does not treat clinic cash scope as SaaS ARCA", async () => {
    const result = await getSaasFiscalInvoicingProvider().issue({
      scope: "clinic_cash_to_patient",
      clinicId: "11111111-1111-1111-1111-111111111111",
      sourcePaymentId: "cash-1",
      amountCents: 1000,
      currency: "ARS",
    });
    expect(result.status).toBe("unsupported_scope");
  });

  it("buildSaasFiscalInvoiceAuditMetadata never invents CAE", async () => {
    const meta = await buildSaasFiscalInvoiceAuditMetadata({
      clinicId: "11111111-1111-1111-1111-111111111111",
      mercadoPagoPaymentId: "99",
      amountCents: 100,
      planId: "solo",
      billingCycle: "monthly",
    });
    const blob = JSON.stringify(meta);
    expect(blob).not.toMatch(/cae/i);
    expect(blob).not.toMatch(/"issued"/);
    expect(meta.prerequisitesPending).toEqual(
      expect.arrayContaining(["cuit", "electronic_invoicing"])
    );
  });

  it("evaluateTaxInvoicingPosture forbids fake invoicing", () => {
    const posture = evaluateTaxInvoicingPosture();
    expect(posture.mercadoPagoReplacesFiscalInvoice).toBe(false);
    expect(posture.officialArcaImplemented).toBe(false);
    expect(posture.fakeInvoicingForbidden).toBe(true);
    expect(posture.extensionPointReady).toBe(true);
    expect(posture.allPrerequisitesRequireAccountant).toBe(true);
  });

  it("documents future schema without shipping fake ARCA issuer", () => {
    expect(FUTURE_FISCAL_SCHEMA_EXTENSIONS[0]?.table).toBe("saas_fiscal_invoice_requests");
    expect(FUTURE_FISCAL_SCHEMA_EXTENSIONS[0].suggestedColumns).toContain("arca_cae");
    const providerSrc = read("src/core/compliance/tax-invoicing-argentina.ts");
    expect(providerSrc).toContain("implementsOfficialArca = false");
    expect(providerSrc).not.toMatch(/generateCae|fakeCae|mockCae/i);
  });
});

describe("fase 20 wiring (static)", () => {
  it("subscription activation attaches fiscal audit metadata", () => {
    const src = read("src/core/billing/subscription-service.ts");
    expect(src).toContain("buildSaasFiscalInvoiceAuditMetadata");
    expect(src).toContain("fiscal: fiscalAudit");
  });

  it("FACTURACION-ARGENTINA.md marks REQUIERE CONTADOR and MP ≠ fiscal", () => {
    const doc = read("docs/compliance/FACTURACION-ARGENTINA.md");
    expect(doc).toContain("REQUIERE CONTADOR");
    expect(doc).toMatch(/NO reemplazan|≠ factura fiscal/i);
    expect(doc).toContain("Convenio Multilateral");
    expect(doc).toContain("DeferredExternalFiscalInvoicingProvider");
    expect(doc).toContain("CUIT");
    expect(doc).toContain("Ingresos Brutos");
  });

  it("cash invoice note stays draft/prep — not fake CAE issuer", () => {
    const src = read("src/lib/actions/cash-register.ts");
    expect(src).toContain("Preparado para integración AFIP/ARCA");
    expect(src).toContain('status: "draft"');
    expect(src).not.toMatch(/cae\s*[:=]/i);
  });
});
