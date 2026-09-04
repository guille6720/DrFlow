import { ExternalLink, LifeBuoy, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";

import {
  DRFLOW_SUPPORT_URL,
  formatWhatsAppDisplay,
  getSalesContactEmail,
  getSalesWhatsAppPhone,
} from "@/core/billing/plans";
import { DrFlowLogo } from "@/core/components/brand/drflow-logo";

import { buildWhatsAppUrl } from "@/shared/utils/whatsapp";

export function MarketingFooter() {
  const email = getSalesContactEmail();
  const phone = getSalesWhatsAppPhone();
  const whatsAppHref =
    phone && buildWhatsAppUrl(phone, "Hola, tengo una consulta sobre NexClinic.")
      ? buildWhatsAppUrl(phone, "Hola, tengo una consulta sobre NexClinic.")
      : null;

  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <DrFlowLogo size="md" href="/" variant="onDark" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed">
              Software clínico para consultorios y clínicas en Argentina. Agenda, historia clínica,
              recetas PAMI y app para pacientes.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">Producto</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/#funcionalidades" className="hover:text-teal-300">
                  Historia clínica
                </Link>
              </li>
              <li>
                <Link href="/#funcionalidades" className="hover:text-teal-300">
                  Agenda inteligente
                </Link>
              </li>
              <li>
                <Link href="/#funcionalidades" className="hover:text-teal-300">
                  Recetas y órdenes PAMI
                </Link>
              </li>
              <li>
                <Link href="/#ia" className="hover:text-teal-300">
                  IA clínica
                </Link>
              </li>
              <li>
                <Link href="/#planes" className="hover:text-teal-300">
                  Planes y precios
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">Contacto</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-2 hover:text-teal-300"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {email}
                </a>
              </li>
              {phone && whatsAppHref ? (
                <li>
                  <a
                    href={whatsAppHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 hover:text-teal-300"
                  >
                    <MessageCircle className="h-4 w-4 shrink-0" />
                    WhatsApp {formatWhatsAppDisplay(phone)}
                  </a>
                </li>
              ) : null}
              <li>
                <a
                  href={DRFLOW_SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-teal-300"
                >
                  <LifeBuoy className="h-4 w-4 shrink-0" />
                  Soporte técnico
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">Legal</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/terminos" className="hover:text-teal-300">
                  Términos de servicio
                </Link>
              </li>
              <li>
                <Link href="/privacidad" className="hover:text-teal-300">
                  Política de privacidad
                </Link>
              </li>
              <li>
                <span className="text-slate-500">Ley 26.529 · Ley 25.326</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-800 pt-8 text-xs sm:flex-row">
          <p>© {new Date().getFullYear()} NexClinic · Opus Org. Todos los derechos reservados.</p>
          <p className="inline-flex items-center gap-2 text-emerald-400/90">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            Todos los sistemas operativos
          </p>
        </div>
      </div>
    </footer>
  );
}
