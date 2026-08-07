"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function CopyCredentialsLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (typeof window === "undefined" || !navigator.clipboard) return;
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  const fullUrl =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-sm text-blue-950">
      <p className="font-medium">Enlace para que el invitado vea sus credenciales</p>
      <p className="mt-1 break-all text-xs text-blue-900/90">{fullUrl}</p>
      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void copyLink()}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Enlace copiado" : "Copiar enlace"}
      </Button>
    </div>
  );
}
