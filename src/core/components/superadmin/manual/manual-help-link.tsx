import { HelpCircle } from "lucide-react";
import Link from "next/link";

/** Small contextual link into the Superadmin manual (does not clutter the UI). */
export function ManualHelpLink({
  anchor,
  label = "Ver manual",
}: {
  anchor: string;
  label?: string;
}) {
  return (
    <Link
      href={`/superadmin/manual#${anchor}`}
      className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
      data-manual-help={anchor}
    >
      <HelpCircle className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Link>
  );
}
