export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { validateProductionEnv } = await import("@/lib/env.server");
    validateProductionEnv({ throwOnError: true });
  }
}
