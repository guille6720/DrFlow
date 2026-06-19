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

export function getProfessionalDisplayName(professional: {
  display_name?: string | null;
  profiles?: { full_name?: string } | null;
  license_number?: string | null;
  id?: string;
}): string {
  return (
    professional.display_name ??
    professional.profiles?.full_name ??
    professional.license_number ??
    (professional.id ? professional.id.slice(0, 8) : "Profesional")
  );
}
