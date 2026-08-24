# Registro de Subprocesadores — DrFlow

> **BORRADOR — REQUIERE REVISIÓN DE ABOGADO EN ARGENTINA ANTES DE SU USO COMERCIAL**

Fuente de verdad técnica: `src/core/compliance/subprocessors.ts` (Fase 23).  
Solo se listan proveedores **descubiertos en el código**. Valores desconocidos: **REQUIERE VERIFICACIÓN**.

## Subprocesadores descubiertos

| id | Proveedor | Propósito | Datos de salud | Jurisdicción | DPA | Doc privacidad/seguridad |
|----|-----------|-----------|----------------|--------------|-----|--------------------------|
| supabase | Supabase Inc. | DB, auth, storage clínico | yes | REQUIERE VERIFICACIÓN | REQUIERE VERIFICACIÓN | https://supabase.com/privacy |
| vercel | Vercel Inc. | Hosting Next.js | unknown | REQUIERE VERIFICACIÓN | REQUIERE VERIFICACIÓN | https://vercel.com/legal/privacy-policy |
| google_vertex | Google Cloud / Vertex AI | IA clínica (opcional) | yes | REQUIERE VERIFICACIÓN | REQUIERE VERIFICACIÓN | https://cloud.google.com/terms/cloud-privacy-notice |
| mercadopago | Mercado Pago | Pagos SaaS | no | Argentina | REQUIERE VERIFICACIÓN | https://www.mercadopago.com.ar/privacidad |
| email_smtp | SMTP / Resend | Email transaccional | unknown | REQUIERE VERIFICACIÓN | REQUIERE VERIFICACIÓN | REQUIERE VERIFICACIÓN |
| sentry | Sentry | Monitoreo errores (opcional) | unknown | REQUIERE VERIFICACIÓN | REQUIERE VERIFICACIÓN | https://sentry.io/privacy/ |
| daily_co | Daily.co | Telemedicina (opcional) | unknown | REQUIERE VERIFICACIÓN | REQUIERE VERIFICACIÓN | https://www.daily.co/privacy |
| jitsi | Jitsi meet.jit.si | Telemedicina default | yes | REQUIERE VERIFICACIÓN | REQUIERE VERIFICACIÓN | https://jitsi.org/security/ |
| meta_whatsapp | Meta WhatsApp Cloud API | Recordatorios / notificaciones | unknown | REQUIERE VERIFICACIÓN | REQUIERE VERIFICACIÓN | https://www.whatsapp.com/legal/privacy-policy-eea |
| byok_ai | IA BYOK clínica | LLM con key de la clínica | yes | REQUIERE VERIFICACIÓN | not_applicable | REQUIERE VERIFICACIÓN |
| refeps | REFEPS / RENaPDiS | Receta electrónica (si homologado) | yes | Argentina (si API oficial) | REQUIERE VERIFICACIÓN | REQUIERE VERIFICACIÓN |

Campos completos por entrada (categorías de datos, review de transferencias, evidencia en código): ver `SUBPROCESSOR_REGISTER` en TypeScript.

## No descubiertos (no inventar)

| Tema | Estado |
|------|--------|
| Analytics de producto (PostHog, GA, Mixpanel, etc.) | **No hay integración en el código** — no se lista como subprocesador |

## Campos obligatorios por proveedor

- purpose  
- categories of data  
- health data: yes / no / unknown  
- possible processing jurisdiction  
- DPA status  
- international transfer review  
- privacy/security documentation status  

## Transferencias internacionales

Los marcados **REQUIERE VERIFICACIÓN** en jurisdicción o DPA pueden implicar transferencia fuera de Argentina. Base legal y cláusulas contractuales: **REQUIERE REVISIÓN DE ABOGADO** antes de uso comercial con datos de salud.

---

*Versión borrador: 2026-08-24. **BORRADOR — REQUIERE REVISIÓN DE ABOGADO EN ARGENTINA ANTES DE SU USO COMERCIAL**. No es asesoramiento legal final. Sincronizar con `subprocessors.ts`.*
