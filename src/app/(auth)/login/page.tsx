"use client";

import { Suspense } from "react";
import { LoginFormView } from "@/core/components/auth/login-form-view";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFormView />
    </Suspense>
  );
}
