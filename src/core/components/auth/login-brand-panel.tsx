import { DrFlowLogo } from "@/core/components/brand/drflow-logo";

export function LoginBrandPanel() {
  return (
    <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-12 text-white lg:flex">
      <div className="flex w-full justify-center pt-2">
        <DrFlowLogo size="xl" href="/" priority variant="onDark" withTagline />
      </div>
      <div>
        <h1 className="text-4xl font-bold leading-tight">
          Gestión clínica simple, segura y profesional
        </h1>
        <p className="mt-4 text-lg text-blue-100">
          Turnos, pacientes, historias clínicas y reportes en una sola plataforma.
        </p>
      </div>
      <p className="text-sm text-blue-300/80">© NexClinic — Software médico SaaS</p>
    </div>
  );
}
