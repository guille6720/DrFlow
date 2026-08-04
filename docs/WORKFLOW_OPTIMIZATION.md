# Workflow Optimization

Clinical workflows optimized for **≤2 clicks** (search) and **1 click** (SOAP, receta, orden, cerrar consulta).

## Click reduction metrics

| Workflow | Before (clicks) | After (clicks) | Saved | Reduction |
|----------|-----------------|----------------|-------|-----------|
| Buscar paciente | 4 | 2 | 2 | 50% |
| Nueva SOAP | 3 | 1 | 2 | 67% |
| Nueva receta | 4 | 1 | 3 | 75% |
| Nueva orden | 4 | 1 | 3 | 75% |
| Cerrar consulta | 3 | 1 | 2 | 67% |

Metrics are defined in `src/lib/utils/clinical-workflow-context.ts` (`WORKFLOW_CLICK_BEFORE`, `WORKFLOW_CLICK_TARGETS`, `workflowClickReduction()`).

### Before paths (legacy)

- **Buscar paciente:** Sidebar → Pacientes → buscar → abrir ficha (4 clics)
- **Nueva SOAP:** Ficha → tab Evoluciones → Nueva consulta (3 clics)
- **Receta:** Ficha → Recetas → Nueva / o lista global con filtro (4 clics)
- **Orden:** Ficha → Órdenes → Nueva (4 clics)
- **Cerrar consulta:** Consulta → Agenda → Finalizar (3 clics)

### After paths (optimized)

- **Buscar paciente (≤2 clics):** Clic en paleta (header) + clic en resultado, **o** `Ctrl+K` + Enter (0 clics)
- **Buscar + SOAP directo (2 clics):** `Ctrl+K` → escribir → botón **SOAP** en fila del paciente
- **Nueva SOAP (1 clic):** Barra de acciones en ficha, menú contextual, FAB en ficha, o `Ctrl+Shift+N`
- **Receta (1 clic):** Barra de acciones, menú contextual, FAB, o `Ctrl+Shift+R`
- **Orden (1 clic):** Barra de acciones, menú contextual, FAB, o `Ctrl+Shift+O`
- **Cerrar consulta (1 clic):** Botón en barra / panel de consulta, o `Ctrl+Shift+Enter`

## Implemented features

### Command palette (`Ctrl+K`)

- Búsqueda global de pacientes (API `/api/command-palette/patients`)
- Acciones contextuales cuando estás en `/pacientes/[id]`
- Botón **SOAP** en cada resultado de paciente (acceso directo en 2 clics desde cualquier pantalla)

### Keyboard shortcuts

| Atajo | Acción |
|-------|--------|
| `Ctrl+K` | Paleta de comandos |
| `Ctrl+Shift+N` | Nueva SOAP (paciente actual) / abrir paleta si no hay paciente |
| `Ctrl+Shift+R` | Nueva receta |
| `Ctrl+Shift+O` | Nueva orden |
| `Ctrl+Shift+Enter` | Cerrar consulta (turno activo) |

Registro: `src/lib/constants/clinical-workflow-shortcuts.ts`  
Handler global: `src/components/clinical-workflow/clinical-workflow-shortcuts.tsx`

### Context menus

- Clic derecho en filas de la lista de pacientes
- Menú: Ficha, Nueva SOAP, Receta, Orden, Editar
- Host: `src/components/clinical-workflow/clinical-context-menu.tsx`

### Slide-over panels

- Consulta, receta, orden y vista de registro en paneles laterales (Phase 1 EMR)
- URL-driven: `?tab=soap&action=nueva`, etc.

### 1-click action bar

- `PatientWorkflowActionBar` en la ficha del paciente
- Incluye **Cerrar consulta** cuando hay turno activo (`?action=nueva&appointment=`)

### Global search

- Paleta + búsqueda en header (`CommandPaletteTrigger`)
- Resultados con deep links al workspace del paciente

## Inline editing

Edición inline de campos clínicos (alergias, medicación habitual) está planificada como fase siguiente; hoy se accede vía enlace a editar perfil clínico.

## Key files

| Archivo | Rol |
|---------|-----|
| `src/lib/utils/clinical-workflow-context.ts` | URLs, métricas de clics |
| `src/components/clinical-workflow/patient-workflow-action-bar.tsx` | Barra 1-clic |
| `src/components/clinical-workflow/clinical-workflow-shortcuts.tsx` | Atajos globales |
| `src/components/clinical-workflow/clinical-context-menu.tsx` | Menús contextuales |
| `src/lib/utils/patient-workspace-actions.ts` | Deep links del workspace |
| `tests/clinical-workflow-context.test.ts` | Tests de métricas y URLs |

## Validation

```bash
npm run lint
npm test
npm run build
```
