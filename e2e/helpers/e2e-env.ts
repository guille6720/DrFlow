export type E2ECredentials = {
  email: string;
  password: string;
  patientId: string;
  insuranceNumber?: string;
  issuePrescription: boolean;
};

export function hasE2ECredentials(): boolean {
  return Boolean(
    process.env.E2E_EMAIL?.trim() &&
      process.env.E2E_PASSWORD?.trim() &&
      process.env.E2E_PATIENT_ID?.trim()
  );
}

export function readE2ECredentials(): E2ECredentials {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();
  const patientId = process.env.E2E_PATIENT_ID?.trim();

  if (!email || !password || !patientId) {
    throw new Error("Missing E2E_EMAIL, E2E_PASSWORD, or E2E_PATIENT_ID.");
  }

  return {
    email,
    password,
    patientId,
    insuranceNumber: process.env.E2E_INSURANCE_NUMBER?.trim() || undefined,
    issuePrescription: process.env.E2E_ISSUE_RX === "1",
  };
}
