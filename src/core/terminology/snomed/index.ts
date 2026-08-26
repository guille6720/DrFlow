/**
 * SNOMED CT terminology abstraction (Phase 2).
 * Does NOT invent codes or ship unauthorized datasets.
 */

export type TerminologyCodingStatus = "mapped" | "unmapped" | "pending";

export type TerminologyCoding = {
  code: string | null;
  display: string | null;
  system: string | null;
  version: string | null;
  originalText: string;
  status: TerminologyCodingStatus;
};

export type TerminologyDomain =
  | "diagnosis"
  | "procedure"
  | "study"
  | "device"
  | "medication";

export type TerminologyLookupInput = {
  domain: TerminologyDomain;
  freeText: string;
  preferredSystem?: string | null;
};

export type TerminologyLookupResult = TerminologyCoding;

export interface TerminologyAdapter {
  readonly id: string;
  lookup(input: TerminologyLookupInput): Promise<TerminologyLookupResult>;
}

export const SNOMED_CT_SYSTEM_URI = "http://snomed.info/sct";

/** Default: preserve free text, never fabricate SNOMED concepts. */
export const unmappedTerminologyAdapter: TerminologyAdapter = {
  id: "snomed-unmapped",
  async lookup(input) {
    return {
      code: null,
      display: null,
      system: null,
      version: null,
      originalText: input.freeText.trim(),
      status: "unmapped",
    };
  },
};

export function resolveTerminologyAdapter(options?: {
  configured?: boolean;
}): TerminologyAdapter {
  if (options?.configured) {
    // Official/licensed service will be registered here when available.
    return unmappedTerminologyAdapter;
  }
  return unmappedTerminologyAdapter;
}

export async function mapFreeTextTerminology(
  input: TerminologyLookupInput,
  adapter: TerminologyAdapter = unmappedTerminologyAdapter
): Promise<TerminologyCoding> {
  const text = input.freeText.trim();
  if (!text) {
    return {
      code: null,
      display: null,
      system: null,
      version: null,
      originalText: "",
      status: "unmapped",
    };
  }
  return adapter.lookup({ ...input, freeText: text });
}
