"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppInstallCard } from "@/components/portal/app-install-card";
import { Smartphone, Calendar, Pill, MessageCircle } from "lucide-react";

const DEMO_SLUG = "drflow";

export function PatientAppLandingSection() {
  const [slug, setSlug] = useState(DEMO_SLUG);

  const normalizedSlug = slug.trim().toLowerCase();
  const portalUrl = normalizedSlug ? `/portal/${normalizedSlug}` : null;

  return (
    <section className="border-y border-blue-100/80 bg-gradient-to-b from-blue-50/80 to-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-medium text-blue-800">
              <Smartphone className="h-4 w-4" />
              App para pacientes
            </p>
            <h2 className="text-3xl font-bold text-slate-900">
              Versión reducida para tus pacientes
            </h2>
            <p className="mt-4 text-slate-600">
              Instalable en el celular (PWA). Tus pacientes pueden pedir turno, solicitar recetas
              por WhatsApp o usar el formulario web — con el mismo logo DrFlow.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              <li className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Reserva de turnos online
              </li>
              <li className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-blue-600" />
                Solicitud de recetas / renovación
              </li>
              <li className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#25D366]" />
                Contacto directo por WhatsApp
              </li>
            </ul>

            <div className="mt-8">
              <AppInstallCard variant="patient" slug={normalizedSlug || DEMO_SLUG} />
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-lg shadow-blue-900/5">
            <h3 className="font-semibold text-slate-900">Acceder al portal del consultorio</h3>
            <p className="mt-1 text-sm text-slate-500">
              Ingresá el identificador que te dio tu médico. Demo:{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{DEMO_SLUG}</code>
            </p>
            <div className="mt-4">
              <Input
                label="Identificador del consultorio"
                placeholder={`ej: ${DEMO_SLUG}`}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {portalUrl ? (
                <Link href={portalUrl}>
                  <Button>
                    <Smartphone className="h-4 w-4" />
                    Abrir app pacientes
                  </Button>
                </Link>
              ) : (
                <Button disabled>Ingresá el identificador</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
