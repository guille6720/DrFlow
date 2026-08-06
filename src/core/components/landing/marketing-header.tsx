import Image from "next/image";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";

const NAV = [
  { href: "/#beneficios", label: "Beneficios" },
  { href: "/#funcionalidades", label: "Funcionalidades" },
  { href: "/#ia", label: "IA Clínica" },
  { href: "/#planes", label: "Planes" },
  { href: "/#faq", label: "FAQ" },
] as const;

type MarketingHeaderProps = {
  variant?: "light" | "dark";
};

export function MarketingHeader({ variant = "light" }: MarketingHeaderProps) {
  const isDark = variant === "dark";

  return (
    <header
      className={
        isDark
          ? "sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur-md"
          : "sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md"
      }
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:py-3.5">
        <Link href="/" className="inline-flex shrink-0 items-center gap-2.5">
          <Image
            src="/drflow-logo.png"
            alt="DrFlow"
            width={40}
            height={40}
            priority
            className="h-9 w-9 rounded-xl object-contain sm:h-10 sm:w-10"
          />
          <span
            className={
              isDark
                ? "hidden text-lg font-bold tracking-tight text-white sm:inline"
                : "hidden text-lg font-bold tracking-tight text-slate-900 sm:inline"
            }
          >
            DrFlow
          </span>
        </Link>

        <nav
          aria-label="Secciones del sitio"
          className="hidden flex-1 items-center justify-center gap-1 md:flex"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                isDark
                  ? "rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                  : "rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-teal-50 hover:text-teal-900"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ButtonLink
            href="/login"
            variant="ghost"
            size="sm"
            className={isDark ? "text-slate-200 hover:bg-white/10 hover:text-white" : undefined}
          >
            Iniciar sesión
          </ButtonLink>
          <ButtonLink href="/probar" size="sm">
            Probar gratis
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
