"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global]", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          background: "#020617",
          color: "#f8fafc",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>NexClinic no pudo cargar</h1>
        <p style={{ maxWidth: "28rem", fontSize: "0.875rem", color: "#94a3b8" }}>
          Hubo un error inesperado. Probá recargar o volvé al login.
        </p>
        {error.digest ? (
          <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#475569" }}>
            Ref: {error.digest}
          </p>
        ) : null}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#0d9488",
              color: "white",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/login")}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #334155",
              background: "transparent",
              color: "#e2e8f0",
              cursor: "pointer",
            }}
          >
            Ir al login
          </button>
        </div>
      </body>
    </html>
  );
}
