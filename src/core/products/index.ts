export { hasAnyProduct, hasProduct, toClientProductsSnapshot } from "@/core/products/product-access";
export {
  type ClinicProductsSnapshot,
  emptyClinicProducts,
  isProductKey,
  PRODUCT_FEATURE_KEYS,
  type ProductFeatureKey,
  type ProductKey,
  productLabel,
  PRODUCTS,
} from "@/core/products/products";
export {
  canAccessPathWithProducts,
  CLINIC_PRODUCT_ROUTE_PREFIXES,
  GERIATRICS_PRODUCT_ROUTE_PREFIXES,
  isHrefAllowedByProducts,
  isProductWhitelistedPath,
  navProductForHref,
  routeRequiresProduct,
} from "@/core/products/route-products";
