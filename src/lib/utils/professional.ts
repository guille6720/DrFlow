export function formatProfessionalLicenses(professional: {
  license_national?: string | null;
  license_provincial?: string | null;
  license_number?: string | null;
}): string | null {
  const national = professional.license_national?.trim();
  const provincial = professional.license_provincial?.trim();

  if (national && provincial && national !== provincial) {
    return `MN ${national} · MP ${provincial}`;
  }
  const single = national || provincial || professional.license_number?.trim();
  return single ? `Mat. ${single}` : null;
}

export type ProfessionalSignatureSource = {
  display_name?: string | null;
  profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  license_national?: string | null;
  license_provincial?: string | null;
  license_number?: string | null;
  signature_text?: string | null;
  signature_image_path?: string | null;
  signature_image_url?: string | null;
  id?: string;
};

export function buildProfessionalSignature(professional: ProfessionalSignatureSource): string {
  const stored = professional.signature_text?.trim();
  if (stored) return stored;

  const name = getProfessionalDisplayName(professional);
  const license = formatProfessionalLicenses(professional);
  return license ? `Dr/a. ${name} — ${license}` : `Dr/a. ${name}`;
}

export function getProfessionalDisplayName(professional: {
  display_name?: string | null;
  profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  license_number?: string | null;
  id?: string;
}): string {
  const profileName = Array.isArray(professional.profiles)
    ? professional.profiles[0]?.full_name
    : professional.profiles?.full_name;

  return (
    professional.display_name ??
    profileName ??
    professional.license_number ??
    (professional.id ? professional.id.slice(0, 8) : "Profesional")
  );
}
