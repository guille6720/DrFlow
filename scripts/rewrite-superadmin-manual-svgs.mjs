import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "public/superadmin-manual");

/** @type {Record<string, string>} */
const svgs = {
  "quick-start.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="280" viewBox="0 0 960 280" role="img">
  <rect width="960" height="280" fill="#0f172a"/>
  <rect x="24" y="24" width="912" height="232" rx="12" fill="#1e293b" stroke="#334155"/>
  <text x="48" y="60" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="18" font-weight="700">Inicio rapido</text>
  <g font-family="system-ui,sans-serif" font-size="12" fill="#e2e8f0">
    <circle cx="80" cy="120" r="18" fill="#0f766e"/><text x="74" y="125" fill="#ccfbf1" font-weight="700">1</text>
    <text x="108" y="125">Clinicas</text>
    <path d="M190 120h36" stroke="#475569" stroke-width="2"/>
    <circle cx="260" cy="120" r="18" fill="#0f766e"/><text x="254" y="125" fill="#ccfbf1" font-weight="700">2</text>
    <text x="288" y="125">Detalle</text>
    <path d="M360 120h36" stroke="#475569" stroke-width="2"/>
    <circle cx="430" cy="120" r="18" fill="#0f766e"/><text x="424" y="125" fill="#ccfbf1" font-weight="700">3</text>
    <text x="458" y="125">Plan / uso</text>
    <path d="M540 120h36" stroke="#475569" stroke-width="2"/>
    <circle cx="610" cy="120" r="18" fill="#0f766e"/><text x="604" y="125" fill="#ccfbf1" font-weight="700">4</text>
    <text x="638" y="125">Accion</text>
    <path d="M710 120h36" stroke="#475569" stroke-width="2"/>
    <circle cx="780" cy="120" r="18" fill="#0f766e"/><text x="774" y="125" fill="#ccfbf1" font-weight="700">5</text>
    <text x="808" y="125">Auditoria</text>
  </g>
  <text x="48" y="200" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">1 Abrir Clinicas - 2 Elegir clinica - 3 Revisar plan, uso y recomendacion</text>
  <text x="48" y="224" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">4 Cambiar plan u override - 5 Confirmar - 6 Verificar historial comercial</text>
</svg>`,

  "dashboard-overview.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="420" viewBox="0 0 960 420" role="img" aria-label="Dashboard Superadmin ilustrativo">
  <rect width="960" height="420" fill="#0f172a"/>
  <rect x="24" y="24" width="912" height="372" rx="12" fill="#1e293b" stroke="#334155"/>
  <text x="48" y="64" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="22" font-weight="700">Superadmin comercial</text>
  <text x="48" y="90" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="13">Ilustracion - datos demo (sin pacientes ni secretos)</text>
  <g font-family="system-ui,sans-serif">
    <rect x="48" y="120" width="140" height="88" rx="10" fill="#0f172a" stroke="#334155"/>
    <text x="64" y="148" fill="#94a3b8" font-size="11">1 - Clinicas</text>
    <text x="64" y="180" fill="#f8fafc" font-size="28" font-weight="700">42</text>
    <rect x="204" y="120" width="140" height="88" rx="10" fill="#0f172a" stroke="#334155"/>
    <text x="220" y="148" fill="#94a3b8" font-size="11">2 - Vivas</text>
    <text x="220" y="180" fill="#5eead4" font-size="28" font-weight="700">31</text>
    <rect x="360" y="120" width="140" height="88" rx="10" fill="#0f172a" stroke="#334155"/>
    <text x="376" y="148" fill="#94a3b8" font-size="11">3 - Upgrade</text>
    <text x="376" y="180" fill="#fbbf24" font-size="28" font-weight="700">7</text>
    <rect x="516" y="120" width="140" height="88" rx="10" fill="#0f172a" stroke="#334155"/>
    <text x="532" y="148" fill="#94a3b8" font-size="11">4 - Cerca limite</text>
    <text x="532" y="180" fill="#fb923c" font-size="28" font-weight="700">4</text>
    <rect x="672" y="120" width="140" height="88" rx="10" fill="#0f172a" stroke="#334155"/>
    <text x="688" y="148" fill="#94a3b8" font-size="11">5 - En limite</text>
    <text x="688" y="180" fill="#f87171" font-size="28" font-weight="700">2</text>
  </g>
  <rect x="48" y="232" width="400" height="140" rx="10" fill="#0f172a" stroke="#334155"/>
  <text x="64" y="260" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="14" font-weight="600">6 - Clinicas por plan</text>
  <text x="64" y="292" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Trial 8 - Basic 14 - Pro 11</text>
  <text x="64" y="316" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Premium 5 - Enterprise 1 - Legacy 3</text>
  <rect x="472" y="232" width="400" height="140" rx="10" fill="#0f172a" stroke="#334155"/>
  <text x="488" y="260" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="14" font-weight="600">7 - Trials expirados / suspendidas</text>
  <text x="488" y="300" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Trials expirados: 3</text>
  <text x="488" y="324" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Suspendidas / expiradas: 5</text>
</svg>`,

  "clinics-list.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="380" viewBox="0 0 960 380" role="img">
  <rect width="960" height="380" fill="#0f172a"/>
  <rect x="24" y="24" width="912" height="332" rx="12" fill="#1e293b" stroke="#334155"/>
  <text x="48" y="60" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="20" font-weight="700">Clinicas</text>
  <rect x="48" y="80" width="280" height="36" rx="8" fill="#0f172a" stroke="#475569"/>
  <text x="64" y="103" fill="#64748b" font-family="system-ui,sans-serif" font-size="12">Buscar clinica, dueno o email...</text>
  <rect x="344" y="80" width="120" height="36" rx="8" fill="#0f172a" stroke="#475569"/>
  <text x="360" y="103" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Plan: Pro</text>
  <rect x="480" y="80" width="140" height="36" rx="8" fill="#0f172a" stroke="#475569"/>
  <text x="496" y="103" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Estado: active</text>
  <g font-family="system-ui,sans-serif" font-size="12">
    <text x="48" y="150" fill="#64748b">Clinica</text>
    <text x="280" y="150" fill="#64748b">Plan</text>
    <text x="400" y="150" fill="#64748b">Estado</text>
    <text x="520" y="150" fill="#64748b">Uso</text>
    <text x="680" y="150" fill="#64748b">Recomendado</text>
    <line x1="48" y1="160" x2="900" y2="160" stroke="#334155"/>
    <text x="48" y="190" fill="#e2e8f0" font-weight="600">Consultorio Demo Norte</text>
    <rect x="280" y="172" width="56" height="24" rx="6" fill="#0f766e"/>
    <text x="292" y="189" fill="#ccfbf1">pro</text>
    <text x="400" y="190" fill="#94a3b8">active</text>
    <text x="520" y="190" fill="#94a3b8">87% pacientes</text>
    <rect x="680" y="172" width="72" height="24" rx="6" fill="#854d0e"/>
    <text x="692" y="189" fill="#fef08a">premium</text>
    <text x="48" y="230" fill="#e2e8f0" font-weight="600">Clinica Demo Sur</text>
    <rect x="280" y="212" width="56" height="24" rx="6" fill="#334155"/>
    <text x="292" y="229" fill="#e2e8f0">basic</text>
    <text x="400" y="230" fill="#94a3b8">active</text>
    <text x="520" y="230" fill="#94a3b8">42%</text>
    <text x="680" y="230" fill="#64748b">-</text>
    <text x="48" y="270" fill="#e2e8f0" font-weight="600">Migracion Demo Legacy</text>
    <rect x="280" y="252" width="64" height="24" rx="6" fill="#7f1d1d"/>
    <text x="290" y="269" fill="#fecaca">legacy</text>
    <text x="400" y="270" fill="#94a3b8">active</text>
    <text x="680" y="270" fill="#fbbf24">Revision manual</text>
  </g>
  <text x="48" y="330" fill="#64748b" font-family="system-ui,sans-serif" font-size="11">Ilustracion - nombres demo - sin emails reales - sin datos clinicos</text>
</svg>`,

  "clinic-detail.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="440" viewBox="0 0 960 440" role="img">
  <rect width="960" height="440" fill="#0f172a"/>
  <rect x="24" y="24" width="912" height="392" rx="12" fill="#1e293b" stroke="#334155"/>
  <text x="48" y="64" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="22" font-weight="700">Consultorio Demo Norte</text>
  <rect x="48" y="84" width="48" height="24" rx="6" fill="#0f766e"/>
  <text x="58" y="101" fill="#ccfbf1" font-family="system-ui,sans-serif" font-size="12">pro</text>
  <rect x="104" y="84" width="64" height="24" rx="6" fill="#1e3a8a"/>
  <text x="116" y="101" fill="#bfdbfe" font-family="system-ui,sans-serif" font-size="12">active</text>
  <rect x="48" y="128" width="420" height="160" rx="10" fill="#0f172a" stroke="#334155"/>
  <text x="64" y="156" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="14" font-weight="600">1 - Suscripcion</text>
  <text x="64" y="186" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Plan: pro</text>
  <text x="64" y="210" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Inicio: 01/03/2026</text>
  <text x="64" y="234" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Trial comercial: -</text>
  <text x="64" y="258" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Uso IA / WA (mes): 120 / 40</text>
  <rect x="492" y="128" width="420" height="160" rx="10" fill="#0f172a" stroke="#334155"/>
  <text x="508" y="156" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="14" font-weight="600">2 - Recomendacion</text>
  <text x="508" y="186" fill="#fef08a" font-family="system-ui,sans-serif" font-size="12">Recomendado: premium</text>
  <text x="508" y="214" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">- Senal Premium: ai.enabled</text>
  <text x="508" y="238" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">- patients.max cerca del limite</text>
  <rect x="48" y="308" width="420" height="88" rx="10" fill="#0f172a" stroke="#334155"/>
  <text x="64" y="336" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="14" font-weight="600">3 - Cambiar plan</text>
  <text x="64" y="364" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Ver diferencias - Confirmar (auditoria)</text>
  <rect x="492" y="308" width="420" height="88" rx="10" fill="#0f172a" stroke="#334155"/>
  <text x="508" y="336" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="14" font-weight="600">4 - Overrides</text>
  <text x="508" y="364" fill="#5eead4" font-family="system-ui,sans-serif" font-size="12">OVERRIDE - fuente efectiva</text>
</svg>`,

  "change-plan.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420" role="img">
  <rect width="720" height="420" fill="#0f172a" opacity="0.85"/>
  <rect x="80" y="40" width="560" height="340" rx="14" fill="#1e293b" stroke="#475569"/>
  <text x="108" y="80" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="18" font-weight="700">Confirmar cambio de plan</text>
  <text x="108" y="112" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="13">Actual: basic - Nuevo: pro</text>
  <text x="108" y="152" fill="#5eead4" font-family="system-ui,sans-serif" font-size="13" font-weight="600">Features ganadas</text>
  <text x="124" y="176" fill="#cbd5e1" font-family="system-ui,sans-serif" font-size="12">- PAMI</text>
  <text x="124" y="196" fill="#cbd5e1" font-family="system-ui,sans-serif" font-size="12">- Reportes avanzados</text>
  <text x="108" y="232" fill="#fbbf24" font-family="system-ui,sans-serif" font-size="13" font-weight="600">Limites aumentados</text>
  <text x="124" y="256" fill="#cbd5e1" font-family="system-ui,sans-serif" font-size="12">- Pacientes: 500 - 2000</text>
  <text x="108" y="292" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="11">Los datos clinicos historicos no se borran.</text>
  <rect x="108" y="320" width="200" height="36" rx="8" fill="#0f172a"/>
  <text x="140" y="343" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="13">Cancelar</text>
  <rect x="328" y="320" width="220" height="36" rx="8" fill="#134e4a"/>
  <text x="360" y="343" fill="#ccfbf1" font-family="system-ui,sans-serif" font-size="13" font-weight="600">Confirmar cambio</text>
</svg>`,

  "feature-override.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="360" viewBox="0 0 720 360" role="img">
  <rect width="720" height="360" fill="#0f172a"/>
  <rect x="24" y="24" width="672" height="312" rx="12" fill="#1e293b" stroke="#334155"/>
  <text x="48" y="60" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="18" font-weight="700">Override de feature</text>
  <g font-family="system-ui,sans-serif" font-size="12" fill="#94a3b8">
    <text x="48" y="100">Feature</text>
    <rect x="48" y="110" width="280" height="34" rx="8" fill="#0f172a" stroke="#475569"/>
    <text x="64" y="132" fill="#e2e8f0">ai.enabled</text>
    <text x="360" y="100">Enabled / Disabled</text>
    <rect x="360" y="110" width="160" height="34" rx="8" fill="#0f172a" stroke="#475569"/>
    <text x="376" y="132" fill="#5eead4">Enabled</text>
    <text x="48" y="180">Limite (opcional)</text>
    <rect x="48" y="190" width="160" height="34" rx="8" fill="#0f172a" stroke="#475569"/>
    <text x="64" y="212" fill="#64748b">-</text>
    <text x="240" y="180">Motivo</text>
    <rect x="240" y="190" width="400" height="34" rx="8" fill="#0f172a" stroke="#475569"/>
    <text x="256" y="212" fill="#e2e8f0">Pilot demo 30 dias</text>
    <text x="48" y="260">Desde / Hasta</text>
    <rect x="48" y="270" width="200" height="34" rx="8" fill="#0f172a" stroke="#475569"/>
    <text x="64" y="292" fill="#e2e8f0">2026-08-20</text>
    <rect x="268" y="270" width="200" height="34" rx="8" fill="#0f172a" stroke="#475569"/>
    <text x="284" y="292" fill="#e2e8f0">2026-09-19</text>
    <rect x="500" y="270" width="140" height="34" rx="8" fill="#0f766e"/>
    <text x="530" y="292" fill="#ccfbf1" font-weight="600">Guardar</text>
  </g>
</svg>`,

  "plans.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="320" viewBox="0 0 960 320" role="img">
  <rect width="960" height="320" fill="#0f172a"/>
  <rect x="24" y="24" width="912" height="272" rx="12" fill="#1e293b" stroke="#334155"/>
  <text x="48" y="60" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="20" font-weight="700">Planes comerciales</text>
  <g font-family="system-ui,sans-serif" font-size="12">
    <rect x="48" y="88" width="140" height="160" rx="10" fill="#0f172a" stroke="#334155"/>
    <text x="64" y="116" fill="#5eead4" font-weight="700">trial</text>
    <text x="64" y="144" fill="#94a3b8">Orden: 10</text>
    <text x="64" y="168" fill="#94a3b8">Activo</text>
    <text x="64" y="192" fill="#64748b">Evaluacion</text>
    <rect x="204" y="88" width="140" height="160" rx="10" fill="#0f172a" stroke="#334155"/>
    <text x="220" y="116" fill="#e2e8f0" font-weight="700">basic</text>
    <text x="220" y="144" fill="#94a3b8">Orden: 20</text>
    <text x="220" y="168" fill="#94a3b8">Activo</text>
    <rect x="360" y="88" width="140" height="160" rx="10" fill="#0f172a" stroke="#334155"/>
    <text x="376" y="116" fill="#5eead4" font-weight="700">pro</text>
    <text x="376" y="144" fill="#94a3b8">Orden: 30</text>
    <text x="376" y="168" fill="#94a3b8">Activo</text>
    <rect x="516" y="88" width="140" height="160" rx="10" fill="#0f172a" stroke="#334155"/>
    <text x="532" y="116" fill="#a78bfa" font-weight="700">premium</text>
    <text x="532" y="144" fill="#94a3b8">Orden: 40</text>
    <rect x="672" y="88" width="140" height="160" rx="10" fill="#0f172a" stroke="#7f1d1d"/>
    <text x="688" y="116" fill="#fca5a5" font-weight="700">legacy</text>
    <text x="688" y="144" fill="#f87171">Interno</text>
    <text x="688" y="168" fill="#f87171">No publico</text>
    <text x="688" y="200" fill="#fecaca">Migracion</text>
  </g>
</svg>`,

  "features.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="300" viewBox="0 0 960 300" role="img">
  <rect width="960" height="300" fill="#0f172a"/>
  <rect x="24" y="24" width="912" height="252" rx="12" fill="#1e293b" stroke="#334155"/>
  <text x="48" y="60" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="20" font-weight="700">Features / entitlements</text>
  <g font-family="system-ui,sans-serif" font-size="12">
    <text x="48" y="100" fill="#64748b">Key</text>
    <text x="280" y="100" fill="#64748b">Tipo</text>
    <text x="400" y="100" fill="#64748b">Metered</text>
    <text x="520" y="100" fill="#64748b">Planes</text>
    <line x1="48" y1="112" x2="900" y2="112" stroke="#334155"/>
    <text x="48" y="140" fill="#5eead4">ai.enabled</text>
    <text x="280" y="140" fill="#94a3b8">boolean</text>
    <text x="400" y="140" fill="#94a3b8">no</text>
    <text x="520" y="140" fill="#94a3b8">premium, enterprise</text>
    <text x="48" y="172" fill="#5eead4">ai.monthly_requests</text>
    <text x="280" y="172" fill="#94a3b8">limit</text>
    <text x="400" y="172" fill="#5eead4">si</text>
    <text x="520" y="172" fill="#94a3b8">premium...</text>
    <text x="48" y="204" fill="#5eead4">pami.enabled</text>
    <text x="280" y="204" fill="#94a3b8">boolean</text>
    <text x="400" y="204" fill="#94a3b8">no</text>
    <text x="520" y="204" fill="#94a3b8">pro+</text>
    <text x="48" y="236" fill="#5eead4">whatsapp.enabled</text>
    <text x="280" y="236" fill="#94a3b8">boolean</text>
    <text x="400" y="236" fill="#94a3b8">no</text>
    <text x="520" y="236" fill="#94a3b8">segun plan</text>
  </g>
</svg>`,

  "usage.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="340" viewBox="0 0 960 340" role="img">
  <rect width="960" height="340" fill="#0f172a"/>
  <rect x="24" y="24" width="912" height="292" rx="12" fill="#1e293b" stroke="#334155"/>
  <text x="48" y="60" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="20" font-weight="700">Consumo (usage)</text>
  <g font-family="system-ui,sans-serif" font-size="12">
    <text x="48" y="100" fill="#64748b">Clinica</text>
    <text x="260" y="100" fill="#64748b">Feature</text>
    <text x="440" y="100" fill="#64748b">Uso / Limite</text>
    <text x="600" y="100" fill="#64748b">%</text>
    <text x="680" y="100" fill="#64748b">Estado</text>
    <line x1="48" y1="112" x2="900" y2="112" stroke="#334155"/>
    <text x="48" y="144" fill="#e2e8f0">Demo Norte</text>
    <text x="260" y="144" fill="#94a3b8">patients.max</text>
    <text x="440" y="144" fill="#94a3b8">1740 / 2000</text>
    <text x="600" y="144" fill="#fb923c">87%</text>
    <rect x="680" y="128" width="100" height="24" rx="6" fill="#854d0e"/>
    <text x="696" y="145" fill="#fef08a">warning</text>
    <text x="48" y="184" fill="#e2e8f0">Demo Sur</text>
    <text x="260" y="184" fill="#94a3b8">patients.max</text>
    <text x="440" y="184" fill="#94a3b8">210 / 500</text>
    <text x="600" y="184" fill="#5eead4">42%</text>
    <rect x="680" y="168" width="100" height="24" rx="6" fill="#134e4a"/>
    <text x="702" y="185" fill="#ccfbf1">normal</text>
    <text x="48" y="224" fill="#e2e8f0">Demo Este</text>
    <text x="260" y="224" fill="#94a3b8">ai.monthly</text>
    <text x="440" y="224" fill="#94a3b8">500 / 500</text>
    <text x="600" y="224" fill="#f87171">100%</text>
    <rect x="680" y="208" width="110" height="24" rx="6" fill="#7f1d1d"/>
    <text x="692" y="225" fill="#fecaca">critical</text>
    <text x="48" y="280" fill="#64748b">Umbrales: 70% informativo - 85% recomendacion - 100% limite</text>
  </g>
</svg>`,

  "recommendations.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="300" viewBox="0 0 960 300" role="img">
  <rect width="960" height="300" fill="#0f172a"/>
  <rect x="24" y="24" width="912" height="252" rx="12" fill="#1e293b" stroke="#334155"/>
  <text x="48" y="60" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="20" font-weight="700">Recomendaciones de upgrade</text>
  <g font-family="system-ui,sans-serif" font-size="12">
    <text x="48" y="100" fill="#64748b">Clinica</text>
    <text x="240" y="100" fill="#64748b">Actual</text>
    <text x="340" y="100" fill="#64748b">Sugerido</text>
    <text x="460" y="100" fill="#64748b">Severidad</text>
    <text x="580" y="100" fill="#64748b">Estado</text>
    <line x1="48" y1="112" x2="900" y2="112" stroke="#334155"/>
    <text x="48" y="144" fill="#e2e8f0">Demo Norte</text>
    <text x="240" y="144" fill="#94a3b8">pro</text>
    <text x="340" y="144" fill="#fef08a">premium</text>
    <text x="460" y="144" fill="#fb923c">high</text>
    <text x="580" y="144" fill="#5eead4">recommended</text>
    <text x="48" y="184" fill="#e2e8f0">Demo Sur</text>
    <text x="240" y="184" fill="#94a3b8">basic</text>
    <text x="340" y="184" fill="#94a3b8">pro</text>
    <text x="460" y="184" fill="#94a3b8">medium</text>
    <text x="580" y="184" fill="#64748b">reviewed</text>
    <text x="48" y="240" fill="#64748b">Las recomendaciones NUNCA cambian el plan solas. Decision humana.</text>
  </g>
</svg>`,
};

fs.mkdirSync(dir, { recursive: true });
for (const [name, content] of Object.entries(svgs)) {
  fs.writeFileSync(path.join(dir, name), `${content.trim()}\n`, "utf8");
}
console.log(`Wrote ${Object.keys(svgs).length} clean SVG files`);
