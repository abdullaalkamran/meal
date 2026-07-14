"use client";

import { useEffect, useState } from "react";
import { repo, type Product, type ProductKind } from "@/lib/data";

/** All store products of one kind (grocery or book), reacting to catalog edits. */
export function useProducts(kind: ProductKind): Product[] {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    return repo.products.subscribe((all) => setProducts(all.filter((p) => p.kind === kind)));
  }, [kind]);

  return products;
}

/** The whole product catalog across kinds — used by the Service Manager store. */
export function useAllProducts(): Product[] {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => repo.products.subscribe(setProducts), []);
  return products;
}
