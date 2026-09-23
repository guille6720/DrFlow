import { DrFlowLogo } from "@/core/components/brand/drflow-logo";

export function LoginBrandPanel() {
  return (
    <aside className="drflow-auth-brand relative hidden w-[46%] flex-col justify-between overflow-hidden p-12 text-white lg:flex">
      <div className="relative z-10 flex w-full justify-start pt-1">
        <DrFlowLogo size="xl" href="/" priority variant="onDark" withTagline />
      </div>
      <div className="relative z-10 max-w-lg">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-200/90">
          Software médico SaaS
        </p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
          Gestión clínica simple, segura y profesional
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-slate-200">
          Turnos, pacientes, historias clínicas y reportes en una sola plataforma.
        </p>
      </div>
      <p className="relative z-10 text-sm text-slate-300/90">© NexClinic — OpusOrg</p>
    </aside>
  );
}
