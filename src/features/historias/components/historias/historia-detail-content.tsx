import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { InformedConsentPanel } from "@/core/components/legal/informed-consent-panel";

import {
  backHrefFromClinicalSubpage,
  patientClinicalHistoryPath,
  patientFichaPath,
  withClinicalHistoryReturn,
} from "@/shared/utils/clinical-navigation";

import { ClinicalDocumentsPanel } from "@/features/historias/components/historias/clinical-documents-panel";
import { ConsultationTimer } from "@/features/historias/components/historias/consultation-timer";
import { FinalizeConsultationButton } from "@/features/historias/components/historias/finalize-consultation-button";
import { HistoriaDetailAuditCard } from "@/features/historias/components/historias/historia-detail-audit-card";
import { HistoriaDetailConsultaCard } from "@/features/historias/components/historias/historia-detail-consulta-card";
import { MedicalOrderPanel } from "@/features/historias/components/historias/medical-order-panel";
import { PrintClinicalRecordButton } from "@/features/historias/components/historias/print-clinical-record-button";
import type { HistoriaDetailPageData } from "@/features/historias/server/load-historia-detail-page";
import { PamiPatientBanner } from "@/features/pacientes/components/pacientes/pami-patient-banner";
import { PatientAppShareControl } from "@/features/pacientes/components/pacientes/patient-app-share-control";
import { PatientWhatsAppButton } from "@/features/pacientes/components/pacientes/patient-whatsapp-button";
import { buildPatientContactMessage } from "@/features/pacientes/utils/patient-messages";
import { PrescriptionPanel } from "@/features/recetas/components/recetas/prescription-panel";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Clinic } from "@/types/database";

type Props = HistoriaDetailPageData & {
  id: string;
  from?: string;
  returnPatientId?: string;
  profileName?: string;
  canIssue: boolean;
  canEditClinical: boolean;
  canViewClinical: boolean;
  canFinalize: boolean;
  clinic: Clinic | null;
};

export function HistoriaDetailContent({
  id,
  from,
  returnPatientId,
  profileName,
  record,
  patient,
  portalSlug,
  doctorInfo,
  audit,
  prescriptions,
  professionalList,
  medicalOrders,
  patientShare,
  clinicalDocuments,
  informedConsent,
  professional,
  canIssue,
  canEditClinical,
  canViewClinical,
  canFinalize,
  clinic,
}: Props) {
  const backHref = backHrefFromClinicalSubpage(
    from,
    returnPatientId ?? patient.id,
    patientClinicalHistoryPath(patient.id)
  );

  return (
    <div className="drflow-historia-detail-screen space-y-6 p-4 sm:p-6">
      <PamiPatientBanner patient={patient} />

      {portalSlug && doctorInfo && (
        <Card title="App para el paciente">
          <PatientAppShareControl
            patientId={patient.id}
            patientName={`${patient.first_name} ${patient.last_name}`}
            patientPhone={patient.phone}
            slug={portalSlug}
            doctor={doctorInfo}
            share={patientShare}
            refreshOnShare={false}
          />
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link href={backHref} className="drflow-link inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <Link
          href={withClinicalHistoryReturn(patientFichaPath(patient.id), patient.id)}
          className="drflow-link text-sm"
        >
          Ficha del paciente
        </Link>
        <Link href={patientClinicalHistoryPath(patient.id)} className="drflow-link text-sm">
          Historia clínica completa
        </Link>
        {record.appointment_id && <ConsultationTimer storageKey={record.appointment_id} />}
        <PrintClinicalRecordButton
          record={record}
          patient={patient}
          professional={professional}
          professionalList={professionalList}
        />
        <PatientWhatsAppButton
          phone={patient.phone}
          message={buildPatientContactMessage(
            `${patient.first_name} ${patient.last_name}`,
            professional?.profiles?.full_name ?? profileName ?? undefined
          )}
          label="WhatsApp paciente"
          size="md"
        />
        <Link href={withClinicalHistoryReturn(`/historias/${id}/editar`, patient.id)}>
          <Button variant="outline" size="sm">
            Editar consulta
          </Button>
        </Link>
        {record.appointment_id && canFinalize && (
          <FinalizeConsultationButton appointmentId={record.appointment_id} />
        )}
        {canIssue && (
          <Link href="/recetas">
            <Button variant="outline" size="sm">
              Ver todas las recetas
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <HistoriaDetailConsultaCard
            record={record}
            professional={professional}
            professionalList={professionalList}
          />
          <InformedConsentPanel
            patientId={patient.id}
            clinicalRecordId={id}
            appointmentId={record.appointment_id}
            chiefComplaint={record.chief_complaint}
            patient={patient}
            professional={{
              full_name: professional?.profiles?.full_name ?? "Profesional",
              license_number:
                professional?.license_national ??
                professional?.license_number ??
                professional?.license_provincial ??
                null,
            }}
            clinic={{
              name: clinic?.name ?? "Consultorio",
              address: clinic?.address,
              phone: clinic?.phone,
            }}
            canEdit={canEditClinical}
            initialConsent={informedConsent}
          />
        </div>

        <div className="space-y-6">
          {canViewClinical && (
            <ClinicalDocumentsPanel
              patientId={patient.id}
              documents={clinicalDocuments}
              canEdit={canEditClinical}
            />
          )}

          <HistoriaDetailAuditCard audit={audit} />

          {canIssue && clinic && (
            <>
              <PrescriptionPanel
                prescriptions={prescriptions}
                patient={patient}
                clinicalRecordId={id}
                diagnosis={record.diagnosis}
                professionals={professionalList}
                clinic={{
                  name: clinic.name,
                  address: clinic.address,
                  phone: clinic.phone,
                }}
                canIssue={canIssue}
              />
              <MedicalOrderPanel
                orders={medicalOrders}
                patient={patient}
                clinicalRecordId={id}
                professionals={professionalList}
                defaultProfessionalId={record.professional_id}
                clinic={{
                  name: clinic.name,
                  address: clinic.address,
                  phone: clinic.phone,
                }}
                canIssue={canIssue}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}