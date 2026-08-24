"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";

import { UserAccountModalContent } from "@/core/components/layout/user-account-modal-content";
import { useClientMounted } from "@/core/hooks/use-client-mounted";
import { useUserAccountModal } from "@/core/hooks/use-user-account-modal";

import type { UserRole } from "@/types/database";

interface UserAccountModalProps {
  open: boolean;
  onClose: () => void;
  role: UserRole | null;
}

export function UserAccountModal({ open, onClose, role: roleProp }: UserAccountModalProps) {
  const mounted = useClientMounted();
  const modal = useUserAccountModal({ open, onClose, role: roleProp });

  if (!open || !mounted) return null;

  return createPortal(
    <div className="drflow-modal-root fixed inset-0 z-[9999] overflow-y-auto overscroll-contain">
      <button
        type="button"
        className="drflow-modal-backdrop fixed inset-0 bg-slate-900/55 backdrop-blur-[2px]"
        aria-label="Cerrar"
        onClick={onClose}
      />

      <div className="relative flex min-h-full items-start justify-center p-4 py-8 sm:items-center sm:py-10">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-account-title"
          className="drflow-modal-panel drflow-card-light relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 id="user-account-title" className="text-lg font-semibold text-slate-900">
                Mi cuenta
              </h2>
              <p className="drflow-modal-subtitle mt-1 text-xs text-slate-500">
                {modal.account?.clinicName ? modal.account.clinicName : "Datos de acceso y permisos"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="drflow-modal-close shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-5">
            <UserAccountModalContent modal={modal} onClose={onClose} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
