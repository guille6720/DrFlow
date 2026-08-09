import { redirect } from "next/navigation";

export default async function LegacyAgendaRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; action?: string }>;
}) {
  const { view, action } = await searchParams;
  const params = new URLSearchParams();
  if (view) params.set("view", view);
  if (action) params.set("action", action);
  const qs = params.toString();
  redirect(qs ? `/turnos/agenda?${qs}` : "/turnos/agenda");
}
