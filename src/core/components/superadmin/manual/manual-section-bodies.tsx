import type { ReactNode } from "react";

import { ManualCallout } from "@/core/components/superadmin/manual/manual-callout";
import {
  MANUAL_COMMON_TASKS,
  MANUAL_GLOSSARY,
  type ManualSectionId,
} from "@/core/components/superadmin/manual/manual-data";
import type { UsageThresholds } from "@/core/entitlements/usage-thresholds";

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal space-y-2 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  );
}

function Bullet({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function renderManualSectionBody(
  id: ManualSectionId,
  thresholds: UsageThresholds
): ReactNode {
  switch (id) {
    case "intro":
      return (
        <>
          <p>
            Superadmin es el centro de control comercial y administrativo de DrFlow. Permite a
            administradores autorizados gestionar planes de clínicas, entitlements, límites,
            overrides, consumo y recomendaciones de upgrade sin modificar información clínica.
          </p>
          <Bullet
            items={[
              "No cambia historias clínicas ni datos de pacientes.",
              "Toda acción comercial sensible queda auditada.",
              "Los cambios de plan son siempre manuales: nunca automáticos.",
            ]}
          />
        </>
      );

    case "quick-start":
      return (
        <>
          <p>Flujo más habitual para revisar una clínica:</p>
          <Steps
            items={[
              "Abrir Clínicas.",
              "Seleccionar una clínica.",
              "Revisar su plan actual.",
              "Revisar el consumo.",
              "Revisar la recomendación de upgrade (si existe).",
              "Cambiar el plan o crear un override si hace falta.",
              "Confirmar la acción.",
              "Revisar la entrada en el historial / auditoría comercial.",
            ]}
          />
        </>
      );

    case "dashboard":
      return (
        <>
          <p>
            El dashboard resume la salud comercial del entorno. Las cifras son agregadas; no muestran
            datos clínicos.
          </p>
          <Bullet
            items={[
              "Total de clínicas — cantidad de clínicas en el sistema.",
              "Suscripciones vivas — clínicas con suscripción activa o en trial vigente.",
              "Trials / Basic / Pro / Premium / Enterprise / Legacy — distribución por plan.",
              "Trials expirados — trials que ya pasaron la ventana sin conversión manual.",
              "Cerca del límite — consumo en banda de advertencia (recomendación de upgrade).",
              "En el límite — consumo en o por encima del límite efectivo.",
              "Upgrade recomendado — clínicas con señal de upgrade pendiente de revisión humana.",
            ]}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Callouts en la ilustración: 1 Clínicas · 2 Vivas · 3 Upgrade · 4 Cerca límite · 5 En
            límite · 6 Por plan · 7 Trials / suspendidas.
          </p>
        </>
      );

    case "clinics":
      return (
        <>
          <p>
            En <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/superadmin/clinics</code>{" "}
            podés buscar y filtrar clínicas por plan, estado de suscripción y señales de
            recomendación.
          </p>
          <Bullet
            items={[
              "Búsqueda por nombre de clínica, dueño o email (solo datos comerciales).",
              "Filtro por plan (trial, basic, pro, premium, enterprise, legacy).",
              "Filtro por estado (active, trialing, suspended, expired, etc.).",
              "Filtro por recomendación (upgrade sugerido / revisión Legacy).",
              "Badges de plan — color/etiqueta del plan comercial actual.",
              "Badges de estado — estado de la suscripción comercial.",
              "Abrí el detalle comercial haciendo clic en la clínica.",
            ]}
          />
        </>
      );

    case "clinic-detail":
      return (
        <>
          <p>La ficha comercial concentra todo lo necesario para decidir sin tocar lo clínico:</p>
          <Bullet
            items={[
              "Plan actual y estado de suscripción.",
              "Fechas de trial (si aplica).",
              "Entitlements efectivos (plan + overrides).",
              "Overrides vigentes o programados.",
              "Consumo del período y límites efectivos.",
              "Plan recomendado y motivos.",
              "Historial comercial / auditoría de cambios.",
            ]}
          />
        </>
      );

    case "change-plan":
      return (
        <>
          <Steps
            items={[
              "Abrir la clínica.",
              "Pulsar Cambiar plan.",
              "Elegir el plan destino.",
              "Revisar el diff: features ganadas y perdidas.",
              "Revisar cambios de límites.",
              "Confirmar. La acción queda auditada.",
            ]}
          />
          <ManualCallout variant="success" title="Datos clínicos">
            Cambiar un plan cambia el acceso comercial. Nunca debe borrar el historial clínico de la
            clínica.
          </ManualCallout>
        </>
      );

    case "downgrade":
      return (
        <ManualCallout variant="warning" title="PRECAUCIÓN — Downgrade">
          <p>
            Antes de bajar de plan, revisá qué features están en uso. Un downgrade puede deshabilitar
            acceso a features, pero no debe borrar información clínica existente.
          </p>
          <p className="mt-2">
            Los downgrades requieren confirmación manual explícita del Superadmin.
          </p>
        </ManualCallout>
      );

    case "overrides":
      return (
        <>
          <p>
            Un override es una excepción por clínica. Ejemplos: Basic + PAMI, Pro + AI, Premium +
            cuota extra de AI, WhatsApp temporal.
          </p>
          <Bullet
            items={[
              "Enabled / Disabled — habilita o fuerza deshabilitado.",
              "Limit — tope numérico opcional para features medidas.",
              "Reason — motivo (recomendado para auditoría).",
              "Starts at / Ends at — ventana de vigencia.",
            ]}
          />
          <ManualCallout variant="info" title="Precedencia">
            <p className="font-mono text-xs sm:text-sm">OVERRIDE &gt; PLAN &gt; DEFAULT &gt; DENY</p>
          </ManualCallout>
        </>
      );

    case "temporary":
      return (
        <>
          <p>Ejemplo: otorgar AI a una clínica Pro por 30 días.</p>
          <Steps
            items={[
              "Abrir la clínica.",
              "Agregar override.",
              "Feature = ai.enabled",
              "Enabled = true",
              "Definir fecha de fin.",
              "Agregar motivo.",
              "Guardar.",
            ]}
          />
          <p>
            El acceso temporal vence automáticamente según la ventana del override (ends at). No hace
            falta un job aparte para “quitar” la feature si la vigencia está bien configurada.
          </p>
        </>
      );

    case "plans":
      return (
        <>
          <p>
            En <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/superadmin/plans</code>{" "}
            administrás Trial, Basic, Pro, Premium, Enterprise y Legacy.
          </p>
          <Bullet
            items={[
              "Editar nombre y descripción.",
              "Cambiar orden de visualización.",
              "Activar / desactivar el plan.",
              "Asignar features y configurar límites.",
            ]}
          />
          <ManualCallout variant="danger" title="Legacy">
            Legacy es interno y solo para migración. Nunca lo hagas público.
          </ManualCallout>
        </>
      );

    case "features":
      return (
        <>
          <p>
            El catálogo de features define keys como{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">ai.enabled</code>,{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">ai.monthly_requests</code>,{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">pami.enabled</code>,{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">whatsapp.enabled</code>.
          </p>
          <Bullet
            items={[
              "Feature key — identificador técnico estable.",
              "Nombre legible.",
              "Boolean vs limit.",
              "Activa / inactiva.",
              "Metered — si el uso se contabiliza.",
              "Default y planes que la usan.",
            ]}
          />
          <p>Preferí desactivar una feature antes que eliminarla del catálogo.</p>
        </>
      );

    case "usage":
      return (
        <>
          <p>
            Consumo muestra uso actual, límite efectivo, restante, porcentaje, período y fuente del
            entitlement.
          </p>
          <Bullet
            items={[
              "Normal — por debajo del umbral informativo.",
              "Informational — alcanzó el umbral info.",
              "Warning — recomendación de upgrade / atención.",
              "Critical — en el límite.",
              "Unlimited — sin tope numérico efectivo.",
            ]}
          />
          <ManualCallout variant="info" title="Umbrales configurados">
            <p>
              {thresholds.infoPct}% → informativo · {thresholds.warnPct}% → upgrade recomendado ·{" "}
              {thresholds.criticalPct}% → límite alcanzado
            </p>
            <p className="mt-1 text-xs opacity-80">
              Valores leídos de la configuración efectiva del entorno (fallback a defaults del motor).
            </p>
          </ManualCallout>
        </>
      );

    case "recommendations":
      return (
        <>
          <p>
            Cada fila muestra plan actual, plan sugerido, severidad, motivos y estado (
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">recommended</code>,{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">reviewed</code>,{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">dismissed</code>,{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">accepted</code>).
          </p>
          <ManualCallout variant="success" title="Decisión humana">
            Las recomendaciones nunca cambian el plan de una clínica automáticamente. El Superadmin
            toma la decisión final.
          </ManualCallout>
        </>
      );

    case "recommendation-examples":
      return (
        <div className="space-y-3">
          <Example formula="Basic + requisito PAMI → recomendar Pro" />
          <Example formula="Pro + requisito AI → recomendar Premium" />
          <Example formula="Pro + AI ya otorgado por override → no recomendar Premium solo por AI" />
          <Example formula="Legacy → revisión comercial manual" />
        </div>
      );

    case "trial":
      return (
        <>
          <p>
            Alta de clínica → plan Trial → estado típico <strong>trialing</strong>.
          </p>
          <Bullet
            items={[
              "Ver estado trial en el listado y en el detalle.",
              "Revisar fecha de expiración del trial.",
              "Evaluar el mejor plan pago según uso y features.",
              "Convertir manualmente con Cambiar plan.",
            ]}
          />
          <ManualCallout variant="warning" title="Sin conversión automática">
            El Trial nunca debe convertirse solo en un plan pago.
          </ManualCallout>
        </>
      );

    case "legacy":
      return (
        <>
          <p>
            Legacy es un plan interno de migración usado para preservar el acceso de clínicas que
            existían antes del nuevo sistema de entitlements comerciales.
          </p>
          <Bullet
            items={[
              "No es un plan comercial público.",
              "No debe asignarse automáticamente.",
              "Las clínicas Legacy requieren revisión comercial manual.",
            ]}
          />
        </>
      );

    case "common-tasks":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {MANUAL_COMMON_TASKS.map((task) => (
            <a
              key={task.title}
              href={task.href}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-teal-400 hover:bg-teal-50/50 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-teal-600 dark:hover:bg-teal-950/30"
            >
              <p className="font-medium text-slate-900 dark:text-slate-50">{task.title}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{task.blurb}</p>
            </a>
          ))}
        </div>
      );

    case "safety":
      return (
        <ManualCallout variant="danger" title="Reglas de seguridad importantes">
          <Bullet
            items={[
              "Nunca borrar datos clínicos al cambiar planes.",
              "Nunca hacer público Legacy.",
              "No otorgar acceso sin motivo cuando la auditoría importa.",
              "Revisar siempre los downgrades con cuidado.",
              "Los overrides tienen precedencia sobre el plan.",
              "Las recomendaciones de uso son informativas.",
              "Los cambios de plan son manuales.",
              "Las acciones de Superadmin se auditan.",
              "Los cambios en producción requieren un proceso aprobado aparte.",
            ]}
          />
        </ManualCallout>
      );

    case "glossary":
      return (
        <dl className="divide-y divide-slate-100 dark:divide-slate-800">
          {MANUAL_GLOSSARY.map((item) => (
            <div key={item.term} className="grid gap-1 py-3 sm:grid-cols-[140px_1fr]">
              <dt className="font-semibold text-slate-900 dark:text-slate-50">{item.term}</dt>
              <dd className="text-slate-600 dark:text-slate-300">{item.definition}</dd>
            </div>
          ))}
        </dl>
      );

    default:
      return null;
  }
}

function Example({ formula }: { formula: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200 sm:text-sm">
      {formula}
    </div>
  );
}
