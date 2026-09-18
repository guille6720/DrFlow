import { redirect } from "next/navigation";

/** Legacy `/agenda` → canonical `/turnos/agenda`, preserving all query params. */
export default async function LegacyAgendaRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const action = typeof params.action === "string" ? params.action : undefined;
  if (action === "new") {
    redirect("/turnos/nuevo");
  }

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "action") continue;
    if (typeof value === "string" && value) qs.set(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (item) qs.append(key, item);
      }
    }
  }
  const suffix = qs.toString();
  redirect(suffix ? `/turnos/agenda?${suffix}` : "/turnos/agenda");
}
