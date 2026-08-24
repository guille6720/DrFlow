const ALLOWED_PROTOCOLS = new Set(["https:"]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata.google",
]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (isPrivateIpv4(host)) return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  return false;
}

export type SafeOutboundUrlOptions = {
  allowedHostnames?: string[];
  allowedHostnameSuffixes?: string[];
};

/** Returns true when URL is safe for server-side fetch (blocks SSRF to private/metadata hosts). */
export function isSafeOutboundUrl(url: string, options: SafeOutboundUrlOptions = {}): boolean {
  try {
    const parsed = new URL(url.trim());
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;

    const hostname = parsed.hostname.toLowerCase();
    if (isBlockedHostname(hostname)) return false;

    const allowedHosts = new Set(
      (options.allowedHostnames ?? []).map((h) => h.toLowerCase().replace(/^\[|\]$/g, ""))
    );
    const suffixes = (options.allowedHostnameSuffixes ?? []).map((s) => s.toLowerCase());

    if (allowedHosts.size > 0 || suffixes.length > 0) {
      const hostOk =
        allowedHosts.has(hostname) ||
        suffixes.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
      if (!hostOk) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function assertSafeOutboundUrl(url: string, options?: SafeOutboundUrlOptions): void {
  if (!isSafeOutboundUrl(url, options)) {
    throw new Error("SSRF_BLOCKED: outbound URL not allowed.");
  }
}
