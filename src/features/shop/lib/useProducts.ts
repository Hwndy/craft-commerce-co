import { useQuery } from "@tanstack/react-query";

import {
  fetchProduct,
  fetchProductNodes,
  fetchProducts,
  PRODUCT_NODES_QUERY_KEY,
  PRODUCT_QUERY_KEY,
  PRODUCTS_QUERY_KEY,
} from "./queries";

export function useProducts() {
  return useQuery({ queryKey: PRODUCTS_QUERY_KEY, queryFn: fetchProducts });
}

export function useProduct(slug: string) {
  return useQuery({ queryKey: PRODUCT_QUERY_KEY(slug), queryFn: () => fetchProduct(slug) });
}

/** The curated product nodes for one Shop region ("shop-wall" or
 * "shop-floor") — the spatial Board's own positions, not a generic list. */
export function useProductNodes(region: string) {
  return useQuery({ queryKey: PRODUCT_NODES_QUERY_KEY(region), queryFn: () => fetchProductNodes(region) });
}
