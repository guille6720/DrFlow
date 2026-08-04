import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Header } from "@/core/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

export default async function CuentaCorrientePage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const sp = await searchParams;
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "manageCashRegister", isSuperadmin) || !clinicId) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const patientId = sp.patient;

  const { data: patients } = await supabase
    .from("patients")
    .select("id, first_name, last_name, document_number")
    .eq("clinic_id", clinicId)
    .order("last_name")
    .limit(200);

  let entries: Array<{
    id: string;
    entry_at: string;
    concept: string;
    debit: number;
    credit: number;
    balance_after: number;
    notes: string | null;
  }> = [];
  let selectedPatient: { id: string; first_name: string; last_name: string } | null = null;

  if (patientId) {
    const { data: p } = await supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .single();
    selectedPatient = p;

    const { data: ledger } = await supabase
      .from("patient_ledger_entries")
      .select("id, entry_at, concept, debit, credit, balance_after, notes")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("entry_at", { ascending: false })
      .limit(100);
    entries = (ledger ?? []).map((e) => ({
      ...e,
      debit: Number(e.debit),
      credit: Number(e.credit),
      balance_after: Number(e.balance_after),
    }));
  }

  const balance = entries[0]?.balance_after ?? 0;

  return (
    <>
      <Header
        title="Cuenta corriente"
        subtitle={selectedPatient ? `${selectedPatient.last_name}, ${selectedPatient.first_name}` : "Seleccioná paciente"}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="p-4 sm:p-6">
        <Link href="/caja">
          <Button variant="outline" size="sm" className="mb-4">
            Volver a caja
          </Button>
        </Link>
        <Card title="Paciente">
          <form method="get" className="flex flex-wrap gap-2">
            <select name="patient" defaultValue={patientId ?? ""} className="drflow-ui-input drflow-ui-select min-w-[240px] rounded-lg border px-3 py-2 text-sm">
              <option value="">— Elegir —</option>
              {(patients ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.last_name}, {p.first_name} — {p.document_number}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm">
              Ver cuenta
            </Button>
          </form>
        </Card>

        {patientId && selectedPatient && (
          <Card title={`Saldo: $${balance.toLocaleString("es-AR")}`} className="mt-4 print:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 text-left">Fecha</th>
                  <th>Concepto</th>
                  <th className="text-right">Debe</th>
                  <th className="text-right">Haber</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-700/30">
                    <td className="py-2">{format(new Date(e.entry_at), "dd/MM/yyyy HH:mm", { locale: es })}</td>
                    <td>{e.concept}</td>
                    <td className="text-right">{e.debit ? `$${e.debit.toLocaleString("es-AR")}` : "—"}</td>
                    <td className="text-right">{e.credit ? `$${e.credit.toLocaleString("es-AR")}` : "—"}</td>
                    <td className="text-right font-medium">${e.balance_after.toLocaleString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </>
  );
}
