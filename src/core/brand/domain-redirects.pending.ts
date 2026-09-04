/**
 * Prepared 301 redirects for production cutover DrFlow → NexClinic.
 *
 * DO NOT merge into vercel.json until manual production approval.
 * When approved, append these entries under `redirects` in vercel.json
 * (or configure equivalent host redirects at the DNS / Vercel domain layer).
 *
 * Legacy hosts to keep alive until cutover:
 * - drflow.opusorg.com
 * - drflow-app-rho.vercel.app
 * - Preview deployments
 */
export const NEXCLINIC_DOMAIN_REDIRECTS_PENDING_APPROVAL = [
  {
    source: "/:path*",
    has: [{ type: "host", value: "drflow.opusorg.com" }],
    destination: "https://nexclinic.com/:path*",
    permanent: true,
  },
  {
    source: "/:path*",
    has: [{ type: "host", value: "www.drflow.opusorg.com" }],
    destination: "https://nexclinic.com/:path*",
    permanent: true,
  },
] as const;
