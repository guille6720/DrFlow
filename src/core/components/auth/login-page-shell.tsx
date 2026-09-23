/** Static shell for login — visible text for LCP before client hydration. */
export function LoginPageShell() {
  return (
    <div className="drflow-auth-page flex min-h-[100dvh]">
      <div className="drflow-auth-brand relative hidden w-[46%] flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div className="h-[108px]" aria-hidden />
        <div className="max-w-lg">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
            Gestión clínica simple, segura y profesional
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-200">
            Turnos, pacientes, historias clínicas y reportes en una sola plataforma.
          </p>
        </div>
        <p className="text-sm text-slate-300/90">© NexClinic — OpusOrg</p>
      </div>

      <main className="flex flex-1 items-center justify-center bg-[#eef2f6] px-4 py-10 sm:px-6">
        <div className="drflow-auth-surface w-full max-w-[420px] rounded-2xl border border-slate-200/80 p-6 shadow-[0_18px_50px_-24px_rgb(15_23_42_/_0.35)] sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Iniciar sesión</h2>
          <p className="mt-2 text-sm text-slate-600">Cargando formulario…</p>
          <div className="mt-8 space-y-4" aria-hidden>
            <div className="h-11 rounded-xl border border-slate-200 bg-slate-50" />
            <div className="h-11 rounded-xl border border-slate-200 bg-slate-50" />
            <div className="h-11 rounded-xl bg-teal-700/90" />
          </div>
        </div>
      </main>
    </div>
  );
}
