import { createNotConfiguredProvider } from "@/core/renapdis/providers/not-configured";
import { createSandboxRepositoryProvider } from "@/core/renapdis/providers/sandbox";
import {
  type RepositoryConfig,
  resolveRepositoryConfig,
} from "@/core/renapdis/repository/repository-config";
import type { PrescriptionRepositoryProvider } from "@/core/renapdis/repository/repository-provider";

/**
 * Provider resolution. Vendor adapters (provider-a.ts, provider-b.ts…) are added here and to
 * `EXTERNAL_REPOSITORY_PROVIDER_IDS` once official docs + credentials exist; until then every
 * external id fails closed.
 */
export function resolveRepositoryProvider(
  config: RepositoryConfig = resolveRepositoryConfig()
): PrescriptionRepositoryProvider {
  if (config.mode === "sandbox" && config.configured) return createSandboxRepositoryProvider();
  switch (config.reason) {
    case "unknown_provider":
    case "adapter_not_registered":
      return createNotConfiguredProvider("unknown_provider");
    case "missing_credentials":
      return createNotConfiguredProvider("missing_credentials");
    default:
      return createNotConfiguredProvider("not_configured");
  }
}
