import { PamiPlanillasPageSkeleton } from "@/features/pami/components/pami/pami-planillas-skeleton";

export default function PamiPlanillasLoading() {
  return (
    <div className="p-4 sm:p-6">
      <PamiPlanillasPageSkeleton />
    </div>
  );
}
