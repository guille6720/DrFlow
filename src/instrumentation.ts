export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "production" &&
    process.env.LIGHTHOUSE_AUDIT !== "1"
  ) {
    const { validateProductionEnv } = await import("@/core/env.server");
    validateProductionEnv({ throwOnError: true });
  }
}
