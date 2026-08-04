"use client";

import { Suspense } from "react";
import { LoginFormView } from "@/components/auth/login-form-view";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFormView />
    </Suspense>
  );
}
