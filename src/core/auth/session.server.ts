import "server-only";

/**
 * Server-only session helpers.
 * Do NOT re-export anything from `"use server"` modules here — that contaminates
 * normal async helpers (getSession, getActiveClinicId, …) and surfaces in
 * production as minified TypeErrors like "a is not a function".
 */
export * from "@/core/auth/session";
