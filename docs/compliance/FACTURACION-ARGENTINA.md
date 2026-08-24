# Facturación fiscal — Argentina

> **REQUIERE CONTADOR** — Este documento no sustituye asesoramiento contable ni fiscal.  
> Fase 20 (compliance monetización) | Branch: `compliance/argentina-monetization`

## Principio

**Los comprobantes de Mercado Pago NO reemplazan facturas fiscales argentinas (ARCA / ex AFIP).**

DrFlow cobra suscripciones SaaS vía Mercado Pago Checkout Pro. La emisión de facturas fiscales es una obligación **separada** del vendedor legal del SaaS (titular comercial), no del cobro electrónico en sí.

Código de postura / extensión futura: `src/core/compliance/tax-invoicing-argentina.ts`.

---

## Determinaciones pendientes — REQUIERE CONTADOR

Antes de comercializar de forma regular, el titular del SaaS debe definir con contador (y, si aplica, abogado):

| Ítem | Descripción | Estado |
|------|-------------|--------|
| Vendedor legal | ¿Quién factura? (persona humana/jurídica) | **REQUIERE CONTADOR** |
| CUIT | CUIT/CUIL del emisor | **REQUIERE CONTADOR** |
| Condición ante ARCA | Monotributo, RI, exento, etc. | **REQUIERE CONTADOR** |
| Actividad económica | Código declarado para software/SaaS | **REQUIERE CONTADOR** |
| Facturación electrónica | PV, tipos A/B/C/E, CAE/CAEA | **REQUIERE CONTADOR** |
| IVA | Alícuota y tratamiento según cliente | **REQUIERE CONTADOR** |
| Ingresos Brutos | Provincial | **REQUIERE CONTADOR** |
| Convenio Multilateral | Si hay multi-jurisdicción | **REQUIERE CONTADOR** |
| Retenciones | Si aplica a clientes B2B | **REQUIERE CONTADOR** |

---

## Mercado Pago vs factura fiscal

| Concepto | Mercado Pago | Factura ARCA |
|----------|--------------|--------------|
| Cobro de suscripción | ✅ Implementado | N/A |
| Recibo / comprobante de pago | ✅ Genera MP | **No es factura fiscal** |
| Factura al cliente (consultorio) | ❌ No | **REQUIERE CONTADOR** + integración oficial |
| Nota de crédito | ❌ No | **REQUIERE CONTADOR** |

Provider por defecto en código: `DeferredExternalFiscalInvoicingProvider` — **no genera CAE ni comprobantes falsos**.

---

## Arquitectura de software (extensión limpia)

### Hoy

| Artefacto | Rol |
|-----------|-----|
| `clinic_subscriptions` | Estado comercial de suscripción |
| `clinic_subscription_payments` | Pagos MP (idempotentes) |
| `buildSaasFiscalInvoiceAuditMetadata` | Deja constancia en audit: MP ≠ fiscal; emisión diferida |
| `cash_invoices` | Drafts de **caja clínica** (clinic→paciente) — **no** es ARCA del vendedor SaaS |

### Futuro (sin migrar en esta fase)

Cola sugerida `saas_fiscal_invoice_requests` ligada a pagos de suscripción, con columnas orientativas: `arca_cae`, `comprobante_tipo`, `punto_venta`, `provider`, `status`, etc. (ver `FUTURE_FISCAL_SCHEMA_EXTENSIONS` en el módulo TS).

```
clinic_subscription_payments
  → saas_fiscal_invoice_requests (futuro)
    → FiscalInvoicingProvider oficial (ARCA / intermediario homologado)
```

Para integrar: implementar `FiscalInvoicingProvider` con `implementsOfficialArca: true` y registrar vía DI — **solo después** de completar ítems REQUIERE CONTADOR.

---

## Alcances que no se deben confundir

1. **SaaS seller → clinic** — facturación fiscal del producto DrFlow (esta fase).  
2. **Clinic → patient** — `cash_invoices` / liquidaciones OS — circuito del consultorio, no sustituye (1).

---

## Bloqueo para monetización

| Tipo | Efecto |
|------|--------|
| Técnico | MP puede cobrar sin ARCA en código |
| Comercial / legal | Operar sin comprobantes fiscales correspondientes es **GESTIÓN EXTERNA OBLIGATORIA** |

**Clasificación:** EXTERNAL ACTION REQUIRED — **REQUIERE CONTADOR**

*No afirma cumplimiento fiscal ni contable.*
