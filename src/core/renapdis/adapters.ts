import type {
  PrescriberIdentityInput,
  PrescriberValidationIssue,
  RefepsProfessionalValidationAdapter,
  RefepsProfessionalValidationAdapterResult,
} from "@/core/renapdis/types";
import { hasAnyProfessionalLicense, resolveEffectiveCuil } from "@/core/renapdis/types";

/**
 * Staging sandbox adapter.
 * Validates local identity completeness only — does NOT call Ministry APIs
 * and does NOT claim legal REFEPS / ReNaPDiS homologation.
 */
export const sandboxRefepsProfessionalAdapter: RefepsProfessionalValidationAdapter = {
  id: "refeps-sandbox-v1",
  async validate(input: PrescriberIdentityInput): Promise<RefepsProfessionalValidationAdapterResult> {
    const issues: PrescriberValidationIssue[] = [];
    const cuil = resolveEffectiveCuil(input);
    if (!cuil) {
      issues.push({
        code: "missing_cuil",
        message: "Falta CUIL del profesional para validación sandbox REFEPS.",
      });
    }
    if (!hasAnyProfessionalLicense(input)) {
      issues.push({
        code: "missing_license",
        message: "Falta matrícula (nacional, provincial o número de licencia).",
      });
    }

    if (issues.length > 0) {
      return {
        status: "failed",
        error: issues.map((i) => i.message).join(" "),
        details: {
          adapter: this.id,
          mode: "sandbox",
          issues,
          legal_validity: "none",
          note: "Sandbox local — sin llamada a APIs oficiales del Ministerio.",
        },
      };
    }

    return {
      status: "sandbox",
      error: null,
      details: {
        adapter: this.id,
        mode: "sandbox",
        cuil_present: true,
        license_present: true,
        refeps_identifier: input.refepsIdentifier,
        legal_validity: "sandbox_only",
        note: "Validación sandbox de identidad local. No constituye homologación ReNaPDiS.",
      },
    };
  },
};

/**
 * Placeholder for the official Ministry REFEPS professional lookup.
 * Intentionally does not invent endpoints, credentials, or response schemas.
 * Plug the real adapter when MSN / ReNaPDiS specifications are available.
 */
export const notConfiguredOfficialRefepsProfessionalAdapter: RefepsProfessionalValidationAdapter =
  {
    id: "refeps-official-not-configured",
    async validate(
      _input: PrescriberIdentityInput
    ): Promise<RefepsProfessionalValidationAdapterResult> {
      return {
        status: "not_configured",
        error:
          "Adaptador oficial REFEPS no configurado. Se requieren especificaciones del Ministerio (endpoint, credenciales, formato de respuesta).",
        details: {
          adapter: "refeps-official-not-configured",
          mode: "not_configured",
          legal_validity: "none",
        },
      };
    },
  };

export function resolveProfessionalValidationAdapter(options?: {
  preferOfficial?: boolean;
  officialConfigured?: boolean;
}): RefepsProfessionalValidationAdapter {
  if (options?.preferOfficial) {
    if (options.officialConfigured) {
      // Official adapter will be registered here when Ministry specs exist.
      return notConfiguredOfficialRefepsProfessionalAdapter;
    }
    return notConfiguredOfficialRefepsProfessionalAdapter;
  }
  return sandboxRefepsProfessionalAdapter;
}
