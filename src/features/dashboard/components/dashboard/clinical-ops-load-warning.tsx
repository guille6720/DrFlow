type Props = {
  message: string;
};

/** Non-blocking warning when dashboard loaders fail — keeps the shell usable. */
export function ClinicalOpsLoadWarning({ message }: Props) {
  return (
    <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4">
      <p className="text-sm text-amber-200">{message}</p>
    </div>
  );
}
