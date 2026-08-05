import { PatientAppIcon } from "@/core/components/brand/patient-app-icon";

import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";

type Props = {
  doctorName: string;
  doctor?: DoctorShareInfo | null;
};

export function PatientPortalHeader({ doctorName, doctor }: Props) {
  return (
    <header className="bg-gradient-to-br from-emerald-600 to-emerald-800 px-4 pb-6 pt-5 text-white shadow-md">
      <div className="mx-auto flex max-w-lg items-center gap-4">
        <PatientAppIcon size="sm" className="shrink-0 shadow-md" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-emerald-200">DrFlow · Pacientes</p>
          <h1 className="truncate text-lg font-bold">{doctorName}</h1>
          {doctor?.specialty ? (
            <p className="truncate text-sm text-emerald-100">{doctor.specialty}</p>
          ) : null}
          {doctor?.licenseLabel ? (
            <p className="text-xs text-emerald-200/90">{doctor.licenseLabel}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
