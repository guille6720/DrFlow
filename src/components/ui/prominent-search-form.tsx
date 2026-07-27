import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface Props {
  action: string;
  inputName?: string;
  placeholder: string;
  defaultValue?: string;
  submitLabel: string;
  hiddenFields?: ReactNode;
  clearHref?: string;
  trailing?: ReactNode;
}

export function ProminentSearchForm({
  action,
  inputName = "q",
  placeholder,
  defaultValue,
  submitLabel,
  hiddenFields,
  clearHref,
  trailing,
}: Props) {
  return (
    <div className="rounded-2xl border-2 border-amber-400/90 bg-gradient-to-br from-amber-50 via-orange-50/40 to-blue-50 p-4 shadow-md shadow-amber-200/40 ring-1 ring-amber-300/50">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-900/80">
        Buscador
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <form className="flex min-w-0 flex-1 flex-wrap items-center gap-2" action={action}>
          {hiddenFields}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-600" />
            <input
              name={inputName}
              defaultValue={defaultValue}
              placeholder={placeholder}
              className="drflow-ui-input w-full rounded-xl border-2 border-amber-300/90 bg-white py-2.5 pl-11 pr-3 text-sm font-medium text-slate-900 shadow-inner placeholder:font-normal placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-400/35"
            />
          </div>
          <Button
            type="submit"
            className="bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-400"
          >
            {submitLabel}
          </Button>
          {clearHref ? (
            <Link href={clearHref}>
              <Button type="button" variant="outline" className="border-amber-200 bg-white/80">
                Limpiar
              </Button>
            </Link>
          ) : null}
        </form>
        {trailing ? <div className="flex flex-wrap items-center gap-2">{trailing}</div> : null}
      </div>
    </div>
  );
}
