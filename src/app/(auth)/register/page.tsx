"use client";

import { Suspense } from "react";
import { RegisterClinicForm } from "@/components/auth/register-clinic-form";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterClinicForm />
    </Suspense>
  );
}
