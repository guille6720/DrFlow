import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  Pill,
  ScrollText,
  Stethoscope,
  Users,
} from "lucide-react";
import Link from "next/link";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session.server";
import { Header } from "@/core/components/layout/header";

import { getPamiMessages } from "@/features/pami/i18n";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const dailyFlowIcons = [Calendar, Stethoscope, ClipboardList, ScrollText, Pill] as const;

export default async function GuiaPamiPage() {
  const t = getPamiMessages().guia;
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, clinic } = await getActiveClinic();
  const isPamiProfile = clinic?.practice_profile === "cabecera_pami";

  return (
    <>
      <Header
        title={t.page.title}
        subtitle={t.page.subtitle}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="space-y-6 p-4 sm:p-6">
        {!isPamiProfile && (
          <div
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            role="alert"
          >
            {t.alert.notActivatedPrefix}{" "}
            <Link href="/configuracion" className="font-medium underline">
              {t.alert.configurationLink}
            </Link>{" "}
            {t.alert.notActivatedSuffix}{" "}
            <strong>{t.alert.activateButton}</strong>.
          </div>
        )}

        <Card title={t.dailyFlow.cardTitle}>
          <div className="grid gap-4 sm:grid-cols-2" role="list">
            {t.dailyFlow.steps.map((item, index) => {
              const Icon = dailyFlowIcons[index] ?? ClipboardList;
              return (
                <Link
                  key={item.step}
                  href={item.href}
                  role="listitem"
                  aria-label={t.dailyFlow.stepAriaLabel(item.step, item.title, item.desc)}
                  className="group flex gap-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4 transition-all hover:border-blue-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white"
                    aria-hidden
                  >
                    {item.step}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-blue-700" aria-hidden />
                      <p className="font-semibold text-slate-900">{item.title}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t.comparison.cardTitle}>
            <ul className="space-y-3 text-sm text-slate-700">
              {t.comparison.items.map((item) => (
                <li key={item.label}>
                  <strong>{item.label}:</strong> {item.body}
                </li>
              ))}
            </ul>
          </Card>

          <Card title={t.checklist.cardTitle}>
            <ul className="space-y-2" aria-label={t.checklist.ariaLabel}>
              {t.checklist.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href="/configuracion" size="sm" aria-label={t.checklist.configurationAria}>
                {t.checklist.configurationButton}
              </ButtonLink>
              <ButtonLink href="/qa" size="sm" variant="outline" aria-label={t.checklist.qaAria}>
                {t.checklist.qaButton}
              </ButtonLink>
            </div>
          </Card>
        </div>

        <Card title={t.patientData.cardTitle}>
          <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 text-blue-600" aria-hidden />
              {t.patientData.dniCredential}
            </div>
            <div className="flex items-start gap-2">
              <Pill className="mt-0.5 h-4 w-4 text-blue-600" aria-hidden />
              {t.patientData.medication}
            </div>
            <div className="flex items-start gap-2">
              <MessageCircle className="mt-0.5 h-4 w-4 text-blue-600" aria-hidden />
              {t.patientData.caregiverPhone}
            </div>
          </div>
          <Link
            href="/pacientes/nuevo"
            aria-label={t.patientData.newPatientAria}
            className="mt-4 inline-flex items-center gap-1 rounded text-sm font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            {t.patientData.newPatientLink} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Card>
      </div>
    </>
  );
}
