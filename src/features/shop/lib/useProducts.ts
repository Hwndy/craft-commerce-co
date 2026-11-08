import { useQuery } from "@tanstack/react-query";

import { fetchProduct, fetchProducts, PRODUCT_QUERY_KEY, PRODUCTS_QUERY_KEY } from "./queries";

export function useProducts() {
  return useQuery({ queryKey: PRODUCTS_QUERY_KEY, queryFn: fetchProducts });
}

export function useProduct(slug: string) {
  return useQuery({ queryKey: PRODUCT_QUERY_KEY(slug), queryFn: () => fetchProduct(slug) });
}
