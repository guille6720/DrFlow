/** Non-production diagnostic logging — allowed by code-quality gate. */
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
}
