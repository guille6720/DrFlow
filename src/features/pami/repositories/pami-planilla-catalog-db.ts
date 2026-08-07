/** Minimal Supabase surface used to load the PAMI planilla catalog RPC. */
export type PamiPlanillaCatalogDbClient = {
  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};