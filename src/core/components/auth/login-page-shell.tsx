/** Static shell for login — visible text for LCP before client hydration. */
export function LoginPageShell() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-12 text-white lg:flex">
        <div className="h-[108px]" aria-hidden />
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

      <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-blue-50/50 to-white p-6">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold text-slate-900">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-slate-500">Cargando formulario…</p>
          <div className="mt-8 space-y-4" aria-hidden>
            <div className="h-11 rounded-xl bg-slate-100" />
            <div className="h-11 rounded-xl bg-slate-100" />
            <div className="h-11 rounded-xl bg-slate-200" />
          </div>
        </div>
      </main>
    </div>
  );
}
