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
