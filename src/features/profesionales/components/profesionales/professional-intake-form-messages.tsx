import { CheckCircle2 } from "lucide-react";

export function ProfessionalIntakeFormMessages({
  error,
  success,
  className = "",
}: {
  error: string | null;
  success: string | null;
  className?: string;
}) {
  return (
    <>
      {error ? <p className={`text-sm text-red-600 ${className}`.trim()}>{error}</p> : null}
      {success ? (
        <p className={`flex items-center gap-2 text-sm text-emerald-700 ${className}`.trim()}>
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </p>
      ) : null}
    </>
  );
}
