import { GeriatricsSectionPage } from "@/features/geriatria/components/geriatrics-section-page";

export default function Page() {
  return (
    <GeriatricsSectionPage
      title="Habitaciones y camas"
      description="Mapa visual de habitaciones/camas con estados libre, ocupada, reservada, mantenimiento y bloqueada. Las reasignaciones mantienen historial append-only."
    />
  );
}
