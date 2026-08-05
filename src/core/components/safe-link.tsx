import Link from "next/link";
import type { ComponentProps } from "react";
import { sanitizeExternalUrl, sanitizeInternalPath } from "@/core/security/xss";

type SafeExternalLinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: string | null | undefined;
};

/** External anchor with protocol whitelist and tabnabbing protection. */
export function SafeExternalLink({
  href,
  children,
  target = "_blank",
  rel = "noopener noreferrer",
  ...rest
}: SafeExternalLinkProps) {
  const safe = sanitizeExternalUrl(href);
  if (!safe) return null;

  return (
    <a href={safe} target={target} rel={rel} {...rest}>
      {children}
    </a>
  );
}

type SafeInternalLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string | null | undefined;
};

/** Internal Next.js link — rejects javascript: and open-redirect paths. */
export function SafeInternalLink({ href, children, ...rest }: SafeInternalLinkProps) {
  const safe = sanitizeInternalPath(href);
  if (!safe) return null;

  return (
    <Link href={safe} {...rest}>
      {children}
    </Link>
  );
}
