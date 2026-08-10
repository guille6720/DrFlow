"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createCashCharge, voidCashCharge } from "@/lib/actions/cash-register";

export function useCashRegister() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [patientId, setPatientId] = useState("");

  function handleCharge(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (!patientId) {
      setError("Seleccioná un paciente");
      return;
    }
    fd.set("patient_id", patientId);
    fd.set("status", "collected");
    startTransition(async () => {
      const res = await createCashCharge(fd);
      if (res.error) setError(res.error);
      else {
        (e.target as HTMLFormElement).reset();
        setPatientId("");
        router.refresh();
      }
    });
  }

  function handleVoid(id: string) {
    const reason = prompt("Motivo de anulación:");
    if (!reason?.trim()) return;
    const fd = new FormData();
    fd.set("charge_id", id);
    fd.set("reason", reason);
    startTransition(async () => {
      await voidCashCharge(fd);
      router.refresh();
    });
  }

  return {
    pending,
    error,
    patientId,
    setPatientId,
    handleCharge,
    handleVoid,
  };
}
