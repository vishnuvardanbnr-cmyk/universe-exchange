import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export interface EarnProduct {
  id: string;
  symbol: string;
  name: string;
  apy: number;
  minAmount: number;
  lockDays: number;
  type: "staking" | "liquid" | "earn";
  tag: string;
  active: boolean;
  createdAt: number;
}

interface EarnContextValue {
  stakingProducts: EarnProduct[];
  liquidProducts: EarnProduct[];
  earnProducts: EarnProduct[];
  allProducts: EarnProduct[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  adminCreateProduct: (data: Omit<EarnProduct, "id" | "active" | "createdAt">) => Promise<void>;
  adminUpdateProduct: (id: string, data: Partial<EarnProduct>) => Promise<void>;
  adminDeleteProduct: (id: string) => Promise<void>;
}

const ADMIN_KEY = "cryptox-admin-2024";

const EarnContext = createContext<EarnContextValue>({
  stakingProducts: [],
  liquidProducts: [],
  earnProducts: [],
  allProducts: [],
  loading: false,
  error: null,
  refresh: async () => {},
  adminCreateProduct: async () => {},
  adminUpdateProduct: async () => {},
  adminDeleteProduct: async () => {},
});

function getBaseUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  if (domain) return `https://${domain}`;
  return "http://localhost:8080";
}

export function EarnProvider({ children }: { children: React.ReactNode }) {
  const [allProducts, setAllProducts] = useState<EarnProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/earn/products/all`, {
        headers: { "x-admin-key": ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAllProducts(json.products ?? []);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to fetch earn products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchProducts();
    intervalRef.current = setInterval(fetchProducts, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchProducts]);

  const adminCreateProduct = useCallback(async (data: Omit<EarnProduct, "id" | "active" | "createdAt">) => {
    const res = await fetch(`${getBaseUrl()}/api/earn/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    await fetchProducts();
  }, [fetchProducts]);

  const adminUpdateProduct = useCallback(async (id: string, data: Partial<EarnProduct>) => {
    const res = await fetch(`${getBaseUrl()}/api/earn/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    await fetchProducts();
  }, [fetchProducts]);

  const adminDeleteProduct = useCallback(async (id: string) => {
    const res = await fetch(`${getBaseUrl()}/api/earn/products/${id}`, {
      method: "DELETE",
      headers: { "x-admin-key": ADMIN_KEY },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    await fetchProducts();
  }, [fetchProducts]);

  const active = allProducts.filter((p) => p.active);
  const stakingProducts = active.filter((p) => p.type === "staking");
  const liquidProducts = active.filter((p) => p.type === "liquid");
  const earnProducts = active.filter((p) => p.type === "earn");

  return (
    <EarnContext.Provider value={{ stakingProducts, liquidProducts, earnProducts, allProducts, loading, error, refresh: fetchProducts, adminCreateProduct, adminUpdateProduct, adminDeleteProduct }}>
      {children}
    </EarnContext.Provider>
  );
}

export function useEarn() {
  return useContext(EarnContext);
}
