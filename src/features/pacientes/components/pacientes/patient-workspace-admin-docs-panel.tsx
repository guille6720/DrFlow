import { AdminDocumentsPanel } from "@/features/administracion/components/secretaria/admin-documents-panel";

type Props = {
  patientId: string;
  patientLabel: string;
  documents: {
    id: string;
    title: string;
    file_name: string;
    category: string;
    created_at: string;
  }[];
};

export function PatientWorkspaceAdminDocsPanel({ patientId, patientLabel, documents }: Props) {
  return (
    <AdminDocumentsPanel
      patientId={patientId}
      patientLabel={patientLabel}
      documents={documents}
    />
  );
}
