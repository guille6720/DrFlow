/** Edge-safe trace id (middleware + server). */
export function createTraceId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}
