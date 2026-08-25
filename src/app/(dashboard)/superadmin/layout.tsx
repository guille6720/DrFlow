import { requireSuperadminPage } from "@/core/entitlements/superadmin-guard.server";

export const dynamic = "force-dynamic";

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperadminPage();
  return (
    <div
      data-superadmin
      className="drflow-superadmin-shell mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6"
    >
      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-sm dark:border-slate-700">
        {[
          { href: "/superadmin", label: "Dashboard" },
          { href: "/superadmin/clinics", label: "Clínicas" },
          { href: "/superadmin/plans", label: "Planes" },
          { href: "/superadmin/features", label: "Features" },
          { href: "/superadmin/usage", label: "Consumo" },
          { href: "/superadmin/recommendations", label: "Recomendaciones" },
          { href: "/superadmin/renapdis-readiness", label: "ReNaPDiS Ops" },
          { href: "/superadmin/manual", label: "Manual de uso" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {item.label}
          </a>
        ))}
      </nav>
      {children}
    </div>
  );
}
