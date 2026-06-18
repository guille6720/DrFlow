import { createClient } from "@/lib/supabase/server";
import { PublicBookingForm } from "@/components/booking/public-booking-form";
import { Activity } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SolicitarTurnoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("public_booking_links")
    .select("*, clinics(id, name, phone, address)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!link) notFound();

  const clinic = link.clinics as {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
  } | null;

  const { data: professionals } = await supabase
    .from("professionals")
    .select("id, display_name, license_number, bio, specialties(name)")
    .eq("clinic_id", link.clinic_id)
    .eq("is_active", true)
    .order("display_name");

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <Activity className="mx-auto h-10 w-10 text-teal-700" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            {clinic?.name ?? "Clínica"}
          </h1>
          <p className="text-slate-600">Reserva de turnos online</p>
          {clinic?.address && (
            <p className="mt-1 text-sm text-slate-500">{clinic.address}</p>
          )}
        </div>

        {(professionals ?? []).length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
            <p>No hay profesionales disponibles para reserva online.</p>
            <p className="mt-2">
              Ejecutá la migración <code className="rounded bg-amber-100 px-1">004_demo_professionals_and_public_booking.sql</code> en Supabase.
            </p>
          </div>
        ) : (
          <PublicBookingForm
            slug={slug}
            clinicName={clinic?.name ?? "Clínica"}
            professionals={professionals ?? []}
          />
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Powered by{" "}
          <Link href="/" className="text-teal-700 hover:underline">
            DrFlow
          </Link>
        </p>
      </div>
    </div>
  );
}
