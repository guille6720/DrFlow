import { createClient } from "@/lib/supabase/server";
import { getPwaIcons } from "@/lib/utils/patient-portal-ready";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const origin = new URL(request.url).origin;
  const supabase = await createClient();

  let clinicName = "Consultorio";

  const { data: link } = await supabase
    .from("public_booking_links")
    .select("clinics(name)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  const linkedClinic = link?.clinics as { name: string } | { name: string }[] | null;
  if (linkedClinic) {
    clinicName = Array.isArray(linkedClinic) ? linkedClinic[0]?.name : linkedClinic.name;
  } else {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name")
      .eq("slug", slug)
      .maybeSingle();
    if (clinic?.name) clinicName = clinic.name;
  }

  const shortName =
    clinicName.length > 14 ? `${clinicName.slice(0, 12).trim()}…` : clinicName;

  const manifest = {
    id: `/portal/${slug}`,
    name: `${clinicName} — DrFlow`,
    short_name: shortName,
    description: "Pedí turnos, recetas y contactá a tu consultorio.",
    start_url: `/portal/${slug}`,
    scope: `/portal/${slug}`,
    display: "standalone" as const,
    background_color: "#2563eb",
    theme_color: "#2563eb",
    orientation: "portrait" as const,
    lang: "es-AR",
    icons: getPwaIcons(origin),
  };

  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
