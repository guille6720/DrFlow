"use client";

import { createContext, type ReactNode, useContext } from "react";

import { hasAnyProduct, hasProduct } from "@/core/products/product-access";
import {
  type ClinicProductsSnapshot,
  emptyClinicProducts,
} from "@/core/products/products";
import { type ProductKey, PRODUCTS } from "@/core/products/products";

const ProductsContext = createContext<ClinicProductsSnapshot>(emptyClinicProducts(null));

export function ProductsProvider({
  snapshot,
  children,
}: {
  snapshot: ClinicProductsSnapshot;
  children: ReactNode;
}) {
  return <ProductsContext.Provider value={snapshot}>{children}</ProductsContext.Provider>;
}

export function useClinicProducts(): ClinicProductsSnapshot {
  return useContext(ProductsContext);
}

export function useHasProduct(productKey: ProductKey): boolean {
  return hasProduct(useClinicProducts(), productKey);
}

export function useHasAnyProduct(): boolean {
  return hasAnyProduct(useClinicProducts());
}

export function useHasGeriatrics(): boolean {
  return useHasProduct(PRODUCTS.GERIATRICS);
}

export function useHasClinicProduct(): boolean {
  return useHasProduct(PRODUCTS.CLINIC);
}
