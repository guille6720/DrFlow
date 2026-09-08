import { GeriatricsSectionPage } from "@/features/geriatria/components/geriatrics-section-page";

export default function Page() {
  return (
    <GeriatricsSectionPage
      title="Residentes"
      description="Gestioná ingresos, egresos, habitación/cama y datos geriátricos. Reutiliza la identidad de pacientes de DrFlow."
      hrefHint="/pacientes"
      hintLabel="Buscar persona en Pacientes"
    />
  );
}
