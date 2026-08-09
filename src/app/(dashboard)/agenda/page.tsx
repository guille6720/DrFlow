import { redirect } from "next/navigation";

export default async function LegacyAgendaRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; action?: string }>;
}) {
  const { action } = await searchParams;
  if (action === "new") {
    redirect("/turnos/nuevo");
  }
  redirect("/turnos/agenda");
}
