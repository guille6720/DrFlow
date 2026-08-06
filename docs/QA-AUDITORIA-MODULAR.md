# DrFlow — Auditoría QA modular

## Forma más fácil de abrirla (en la app)

1. Entrá a DrFlow logueado
2. Andá a **Ayuda** (`/ayuda`)
3. Clic en **「Abrir auditoría」**

O directo: **https://drflow.opusorg.com/ayuda/auditoria-modular**

Ahí tenés checklists interactivos por módulo, links para probar y rutas de código.

---

## En Cursor (documento Markdown)

**Ctrl+P** y escribí:

```
QA-AUDITORIA
```

Debería aparecer este archivo: `docs/QA-AUDITORIA-MODULAR.md`

> El archivo `.canvas.tsx` vive **fuera** del proyecto DrFlow (carpeta interna de Cursor), por eso Ctrl+P no lo encuentra. Usá la app o este Markdown.

---

## Canvas (opcional, solo Cursor)

Ruta completa (File → Open File → pegar):

```
C:\Users\pigus\.cursor\projects\c-dev\canvases\drflow-qa-auditoria-modular.canvas.tsx
```

Luego botón **Open Canvas** arriba del editor.

---

## Módulos incluidos

| Módulo | Capa | Qué audita |
|--------|------|------------|
| auth | Plataforma | Login, registro, sesión |
| permissions | Plataforma | Roles, INVITADO, guards |
| pacientes | Feature | Workspace HC, órdenes |
| historias | Feature | SOAP, tablas EHR |
| recetas | Feature | Órdenes preview/editar/eliminar |
| configuracion | Feature | Invitaciones, permisos |
| dashboard | Feature | KPIs, accesos rápidos |
| data | Datos | RLS, migraciones 071–073 |

Ver checklist completo en `/ayuda/auditoria-modular` o en [QA_CHECKLIST.md](./QA_CHECKLIST.md).
