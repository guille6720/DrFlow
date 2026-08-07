export type RefreshAppRouterFailureReason =
  | "refresh_unavailable"
  | "refresh_threw"
  | "refresh_timeout"
  | "unknown";

export type RefreshAppRouterResult =
  | { ok: true }
  | { ok: false; reason: RefreshAppRouterFailureReason; message: string };

export const REFRESH_APP_ROUTER_USER_MESSAGE =
  "La planilla se guardó correctamente, pero no pudimos actualizar la pantalla. Podés usar «Actualizar» o recargar la página.";

export type RefreshAppRouterContext = {
  scope?: string;
  metadata?: Record<string, unknown>;
};
