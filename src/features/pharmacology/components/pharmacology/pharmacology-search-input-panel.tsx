import { PathologyMatchList } from "@/features/pharmacology/components/pharmacology/pathology-match-list";
import { PathologyTypeahead } from "@/features/pharmacology/components/pharmacology/pathology-typeahead";
import { SymptomTypeahead } from "@/features/pharmacology/components/pharmacology/symptom-typeahead";
import { VademecumTypeahead } from "@/features/pharmacology/components/pharmacology/vademecum-typeahead";

import { Card } from "@/components/ui/card";
import type {
  PamiVademecumResult,
  PathologyBySymptomResult,
  PathologySearchResult,
  PharmacologySearchMode,
  SymptomSearchResult,
} from "@/types/pharmacology";

interface Props {
  mode: PharmacologySearchMode;
  selected: PathologySearchResult | null;
  symptoms: SymptomSearchResult[];
  pathologyMatches: PathologyBySymptomResult[];
  matchesLoading: boolean;
  matchesError: string | null;
  onPathologySelect: (pathology: PathologySearchResult) => void;
  onClearPathology: () => void;
  onSymptomsChange: (symptoms: SymptomSearchResult[]) => void;
  onSymptomPathologySelect: (pathology: PathologyBySymptomResult) => void;
  onVademecumResults: (items: PamiVademecumResult[]) => void;
  onVademecumLoading: (loading: boolean) => void;
  onVademecumError: (error: string | null) => void;
  onVademecumQueryChange: (length: number) => void;
}

export function PharmacologySearchInputPanel({
  mode,
  selected,
  symptoms,
  pathologyMatches,
  matchesLoading,
  matchesError,
  onPathologySelect,
  onClearPathology,
  onSymptomsChange,
  onSymptomPathologySelect,
  onVademecumResults,
  onVademecumLoading,
  onVademecumError,
  onVademecumQueryChange,
}: Props) {
  if (mode === "pathology") {
    return (
      <Card className="border-blue-100">
        <PathologyTypeahead
          selected={selected}
          onSelect={onPathologySelect}
          onClear={onClearPathology}
        />
        <p className="mt-3 text-xs text-slate-500">
          Tip: buscá por código (<span className="font-mono">I10</span>,{" "}
          <span className="font-mono">E11</span>) o nombre de enfermedad.
        </p>
      </Card>
    );
  }

  if (mode === "symptoms") {
    return (
      <div className="space-y-4">
        <Card className="border-violet-100">
          <SymptomTypeahead selected={symptoms} onChange={onSymptomsChange} />
          <p className="mt-3 text-xs text-slate-500">
            Tip: podés usar frases comunes como &quot;dolor en las piernas&quot;,
            &quot;dolor de garganta&quot; o &quot;falta de aire&quot;.
          </p>
        </Card>

        <PathologyMatchList
          items={pathologyMatches}
          loading={matchesLoading}
          error={matchesError}
          symptomCount={symptoms.length}
          onSelect={onSymptomPathologySelect}
          selectedId={selected?.id}
        />
      </div>
    );
  }

  return (
    <Card className="border-emerald-100">
      <VademecumTypeahead
        onResults={onVademecumResults}
        onLoading={onVademecumLoading}
        onError={onVademecumError}
        onQueryChange={(q) => onVademecumQueryChange(q.trim().length)}
      />
      <p className="mt-3 text-xs text-slate-500">
        Tip: buscá por marca (<span className="font-mono">BETASERC</span>), principio activo (
        <span className="font-mono">losartán</span>) o código Alfabeta.
      </p>
    </Card>
  );
}
