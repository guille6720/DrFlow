import { withAttemptTimeout } from "@/core/renapdis/repository/repository-client";
import type { RepositoryConfig } from "@/core/renapdis/repository/repository-config";
import {
  classifyHttpStatus,
  RepositoryProviderError,
} from "@/core/renapdis/repository/repository-errors";
import type { PrescriptionRepositoryProvider } from "@/core/renapdis/repository/repository-provider";
import type {
  CancelPrescriptionResponse,
  CuirStatusResponse,
  CuirVerificationResponse,
  NationalPrescriptionRequest,
  NationalPrescriptionResponse,
  RepositoryCallContext,
} from "@/core/renapdis/repository/repository-types";
import { assertValidProviderResponse } from "@/core/renapdis/repository/repository-validation";

export type ProviderHttpRequest = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path relative to RENAPDIS_REPOSITORY_API_URL — defined by the vendor adapter from official docs. */
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type ProviderHttpResponse = {
  status: number;
  headers: Headers;
  json: unknown;
};

/**
 * Supplies auth headers/transport for the configured auth mode (OAuth2, JWT, mTLS, API key).
 * Implemented per vendor once official documentation and credentials exist.
 */
export interface RepositoryCredentialsProvider {
  getAuthHeaders(signal: AbortSignal): Promise<Record<string, string>>;
}

/**
 * Vendor mapping layer (NexClinic DTO ↔ vendor schema). One file per vendor
 * (e.g. `providers/provider-a.ts`) implements this and registers in `providers/index.ts`.
 */
export interface ExternalRepositoryAdapter {
  readonly id: string;
  buildSubmit(request: NationalPrescriptionRequest, ctx: RepositoryCallContext): ProviderHttpRequest;
  parseSubmit(response: ProviderHttpResponse): Omit<Extract<NationalPrescriptionResponse, { mode: "external" }>, "mode" | "providerId">;
  buildStatus(repositoryPrescriptionId: string, ctx: RepositoryCallContext): ProviderHttpRequest;
  parseStatus(response: ProviderHttpResponse): Omit<CuirStatusResponse, "providerId" | "checkedAt">;
  buildVerify(cuir: string, ctx: RepositoryCallContext): ProviderHttpRequest;
  parseVerify(response: ProviderHttpResponse): Omit<CuirVerificationResponse, "providerId" | "checkedAt">;
  buildCancel(repositoryPrescriptionId: string, reasonCode: string, ctx: RepositoryCallContext): ProviderHttpRequest;
  parseCancel(response: ProviderHttpResponse): Omit<CancelPrescriptionResponse, "providerId">;
  /** Optional refinement of 4xx bodies into the taxonomy using the vendor's documented error codes. */
  classifyError?(response: ProviderHttpResponse): RepositoryProviderError | null;
}

export type ExternalProviderDeps = {
  fetchImpl?: typeof fetch;
  credentials: RepositoryCredentialsProvider;
};

export function createExternalRepositoryProvider(
  adapter: ExternalRepositoryAdapter,
  config: RepositoryConfig,
  deps: ExternalProviderDeps
): PrescriptionRepositoryProvider {
  if (config.mode !== "external" || !config.configured || !config.apiUrl) {
    throw new RepositoryProviderError(config.reason === "missing_credentials" ? "missing_credentials" : "not_configured");
  }
  const baseUrl = config.apiUrl.replace(/\/$/, "");
  const fetchImpl = deps.fetchImpl ?? fetch;

  async function execute(req: ProviderHttpRequest, ctx: RepositoryCallContext): Promise<ProviderHttpResponse> {
    return withAttemptTimeout(ctx.timeoutMs, async (signal) => {
      const auth = await deps.credentials.getAuthHeaders(signal);
      const res = await fetchImpl(`${baseUrl}${req.path.startsWith("/") ? "" : "/"}${req.path}`, {
        method: req.method,
        headers: {
          Accept: "application/json",
          ...(req.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...req.headers,
          ...auth,
        },
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
        signal,
        cache: "no-store",
      });
      const json: unknown = await res.json().catch(() => null);
      const response: ProviderHttpResponse = { status: res.status, headers: res.headers, json };
      if (!res.ok) {
        throw adapter.classifyError?.(response) ?? new RepositoryProviderError(classifyHttpStatus(res.status), { httpStatus: res.status });
      }
      return response;
    });
  }

  return {
    id: adapter.id,
    mode: "external",
    async submitPrescription(request, ctx) {
      const parsed = adapter.parseSubmit(await execute(adapter.buildSubmit(request, ctx), ctx));
      return assertValidProviderResponse({ ...parsed, mode: "external", providerId: adapter.id });
    },
    async getPrescriptionStatus(id, ctx) {
      const parsed = adapter.parseStatus(await execute(adapter.buildStatus(id, ctx), ctx));
      return { ...parsed, providerId: adapter.id, checkedAt: new Date().toISOString() };
    },
    async verifyCuir(cuir, ctx) {
      const parsed = adapter.parseVerify(await execute(adapter.buildVerify(cuir, ctx), ctx));
      return { ...parsed, providerId: adapter.id, checkedAt: new Date().toISOString() };
    },
    async cancelPrescription(id, reasonCode, ctx) {
      const parsed = adapter.parseCancel(await execute(adapter.buildCancel(id, reasonCode, ctx), ctx));
      return { ...parsed, providerId: adapter.id };
    },
  };
}
