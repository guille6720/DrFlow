import { redirect } from "next/navigation";

import { ProductRequiredError } from "@/core/products/products.server";

import { requireGeriatricsClinic } from "@/features/geriatria/server/geriatrics.server";

export default async function GeriatriaLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireGeriatricsClinic();
  } catch (err) {
    if (err instanceof ProductRequiredError) redirect("/sin-productos");
    redirect("/dashboard");
  }
  return children;
}
