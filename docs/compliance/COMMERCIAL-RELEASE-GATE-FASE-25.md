# Gate de liberación comercial — Fase 25

> Gate documentado + automatizado. Categorías PASS / WARNING / BLOCKER / EXTERNAL ACTION REQUIRED.  
> Procedimientos legales externos clasificados por separado.

Última actualización: 2026-08-24 | Branch: `compliance/argentina-monetization`

---

## Objetivo

Formalizar el gate de monetización: bloquear comercialización ante fallos técnicos críticos; no mezclar obligaciones legales/contables como si fueran bugs de código.

---

## Entregables

| Entrega | Ubicación |
|---------|-----------|
| Doc gate | `docs/compliance/MONETIZATION-GATE.md` |
| Catálogo | `src/core/compliance/commercial-release-gate.ts` |
| Script | `scripts/commercial-release-gate.mjs` |
| npm | `npm run commercial:gate` |
| Tests | `tests/commercial-release-gate-fase25.test.ts` |

---

## BLOCKERs técnicos mínimos

1. Cross-tenant isolation tests fail  
2. Critical RLS fail  
3. Sensitive data publicly accessible  
4. Secrets exposed  
5. AI sends identifiable patient data unexpectedly  
6. Payment entitlement forgeable  
7. Audit trail integrity broken  

---

## Cómo correr

```bash
npm run commercial:gate
```

---

## Veredicto de la fase

**OK** — Gate documentado y automatizado; EXTERNAL separado de BLOCKER técnico.

*Pasar el gate técnico no implica listo legal/fiscal/AAIP.*
