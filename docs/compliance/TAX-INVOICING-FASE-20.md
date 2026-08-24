# Facturación fiscal / ARCA — Fase 20

> Postura técnica: MP ≠ factura fiscal; arquitectura lista para integración oficial.  
> **No constituye asesoramiento contable ni legal.**

Última actualización: 2026-08-24 | Branch: `compliance/argentina-monetization`

---

## Objetivo

Documentar que la monetización requiere definir vendedor legal, CUIT, condición ARCA, actividad económica, facturación electrónica, IVA, IIBB y posible Convenio Multilateral — todo marcado **REQUIERE CONTADOR**. No implementar facturación ARCA falsa. Dejar extensión limpia para un proveedor oficial futuro.

---

## Entregables

| Entrega | Ubicación |
|---------|-----------|
| Doc fiscal | `docs/compliance/FACTURACION-ARGENTINA.md` |
| Módulo postura + puerto | `src/core/compliance/tax-invoicing-argentina.ts` |
| Audit al activar pago | `buildSaasFiscalInvoiceAuditMetadata` en webhook/suscripción |
| Tests | `tests/tax-invoicing-fase20.test.ts` |

---

## Controles

| Control | Estado |
|---------|--------|
| MP no tratado como factura fiscal | ✅ `assertMercadoPagoReceiptIsNotFiscalInvoice` |
| Sin CAE / comprobante falso | ✅ `DeferredExternalFiscalInvoicingProvider` |
| Prerequisites contador catalogados | ✅ 8 ítems `REQUIERE_CONTADOR` |
| Puerto `FiscalInvoicingProvider` | ✅ listo para adapter oficial |
| Schema futuro documentado | ✅ sin migración inventada |
| Confusión caja vs SaaS aclarada | ✅ |

---

## Qué no se hizo (a propósito)

- No hay llamadas a webservice ARCA/AFIP.
- No se emiten números de factura, CAE ni PDFs fiscales “mock”.
- No se crea tabla fiscal en DB hasta que haya proveedor real + definición contable.

---

## Tests / verificación

- `npx vitest run tests/tax-invoicing-fase20.test.ts`
- `npx tsc --noEmit`

---

## Veredicto técnico

**OK** — Principio MP ≠ factura documentado y reforzado en código; prerequisitos **REQUIERE CONTADOR**; arquitectura extensible sin facturación falsa.

*La comercialización regular sigue dependiendo de gestión externa contable/fiscal.*
