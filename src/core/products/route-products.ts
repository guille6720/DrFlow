import { hasProduct } from "@/core/products/product-access";
import type { ClinicProductsSnapshot, ProductKey } from "@/core/products/products";
import { PRODUCTS } from "@/core/products/products";

/** Routes that require product.clinic (ambulatory clinic modules). Shared routes omitted. */
export const CLINIC_PRODUCT_ROUTE_PREFIXES = [
  "/consultas",
  "/historias",
  "/turnos",
  "/agenda",
  "/sala-espera",
  "/atenciones",
  "/telemedicina",
  "/caja",
  "/facturacion",
  "/pami",
  "/guia-pami",
  "/recetas",
  "/plantillas",
  "/plantillas-recetas",
  "/recordatorios",
  "/secretaria",
] as const;

export const GERIATRICS_PRODUCT_ROUTE_PREFIXES = ["/geriatria"] as const;

/** Always allowed regardless of products (auth, settings, team, help). */
export const PRODUCT_WHITELIST_PREFIXES = [
  "/dashboard",
  "/configuracion",
  "/ingreso-profesionales",
  "/firmas",
  "/ayuda",
  "/pacientes",
  "/reportes",
  "/datos",
  "/superadmin",
  "/qa",
  "/pagos",
  "/trial-expirado",
  "/sin-productos",
  "/gemini",
  "/herramientas",
] as const;

export function routeRequiresProduct(path: string): ProductKey | null {
  if (!path) return null;
  if (GERIATRICS_PRODUCT_ROUTE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return PRODUCTS.GERIATRICS;
  }
  if (CLINIC_PRODUCT_ROUTE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return PRODUCTS.CLINIC;
  }
  return null;
}

export function isProductWhitelistedPath(path: string): boolean {
  return PRODUCT_WHITELIST_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function canAccessPathWithProducts(
  path: string,
  snapshot: ClinicProductsSnapshot
): boolean {
  if (isProductWhitelistedPath(path)) {
    if (path === "/sin-productos") return true;
    // Dashboard / config always OK; empty-products page handles messaging.
    return true;
  }
  const required = routeRequiresProduct(path);
  if (!required) return true;
  return hasProduct(snapshot, required);
}

/** Nav href → required product (null = shared / always if other gates pass). */
export function navProductForHref(href: string): ProductKey | null {
  return routeRequiresProduct(href);
}

export function isGeriatricsHref(href: string): boolean {
  return href === "/geriatria" || href.startsWith("/geriatria/");
}

export function isHrefAllowedByProducts(
  href: string,
  snapshot: ClinicProductsSnapshot | null
): boolean {
  if (!snapshot) return !isGeriatricsHref(href);
  const required = navProductForHref(href);
  if (!required) {
    // Hide clinic-only groups when clinic product off — handled via prefixes on children.
    return true;
  }
  return hasProduct(snapshot, required);
}

/**
 * Geriatría stays visible in the sidebar even when the product is OFF.
 * Click handlers must no-op until Superadmin enables product.geriatrics.
 */
export function isHrefVisibleInNav(
  href: string,
  snapshot: ClinicProductsSnapshot | null
): boolean {
  if (isGeriatricsHref(href)) return true;
  return isHrefAllowedByProducts(href, snapshot);
}

export function isHrefNavLockedByProducts(
  href: string,
  snapshot: ClinicProductsSnapshot | null
): boolean {
  if (!isGeriatricsHref(href)) return false;
  return !isHrefAllowedByProducts(href, snapshot);
}
