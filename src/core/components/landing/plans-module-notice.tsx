import Link from "next/link";

import { commercialFeatureLabel } from "@/core/entitlements/feature-labels";
import { isFeatureKey } from "@/core/entitlements/features";

export function PlansModuleNotice({ featureKey }: { featureKey: string }) {
  const label = commercialFeatureLabel(featureKey);

  return (
    <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
      <p className="font-medium">
        Necesitás un plan que incluya <span className="text-amber-900">{label}</span>.
      </p>
      <p className="mt-1 text-amber-900/90">
        Elegí un plan abajo o consultanos por WhatsApp. Si ya tenés acceso, revisá{" "}
        <Link href="/configuracion" className="font-medium text-teal-800 underline">
          Configuración → Tu plan
        </Link>
        .
      </p>
      {!isFeatureKey(featureKey) ? (
        <p className="mt-2 text-xs text-amber-800/80">Referencia: {featureKey}</p>
      ) : null}
    </div>
  );
}
