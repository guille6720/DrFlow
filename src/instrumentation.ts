export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "production" &&
    process.env.LIGHTHOUSE_AUDIT !== "1"
  ) {
    const { validateProductionEnv } = await import("@/core/env.server");
    const result = validateProductionEnv({ throwOnError: false });

    if (!result.ok) {
      console.error(
        "[drflow] Production env incomplete:",
        result.missing.join(", "),
        "— see .env.example"
      );
    } else if (result.warnings.length > 0) {
      console.error("[drflow] Production env warnings:", result.warnings.join("; "));
    }
  }
}
