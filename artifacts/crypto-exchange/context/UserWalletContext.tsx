import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE
  ? process.env.EXPO_PUBLIC_API_BASE
  : `https://${process.env["EXPO_PUBLIC_DOMAIN"] ?? "localhost:8080"}`;

export interface UserBalance {
  coin: string;
  available: number;
  locked: number;
  updated_at: string;
}

export interface DepositAddress {
  coin: string;
  network: string;
  address: string;
  memo?: string;
  label?: string;
}

export interface DepositNetwork {
  coin: string;
  network: string;
  label?: string;
}

export interface DepositRequest {
  coin: string;
  network: string;
  amount?: number;
  txHash?: string;
  note?: string;
}

export interface WithdrawRequest {
  coin: string;
  network: string;
  amount: number;
  toAddress: string;
  memo?: string;
}

export interface TxHistoryItem {
  id: string | number;
  source: "deposit_request" | "withdrawal" | "on_chain";
  coin: string;
  network: string;
  amount: number;
  status: string;
  created_at: string;
  tx_hash?: string;
  to_address?: string;
  note?: string;
}

interface UserWalletCtx {
  balances: UserBalance[];
  loading: boolean;
  tradableCoins: string[];
  fetchBalances: () => Promise<void>;
  fetchTradableCoins: () => Promise<void>;
  getDepositAddress: (coin: string, network: string) => Promise<DepositAddress | null>;
  getDepositNetworks: (coin: string) => Promise<DepositNetwork[]>;
  submitDepositRequest: (req: DepositRequest) => Promise<{ id: string }>;
  submitWithdrawal: (req: WithdrawRequest) => Promise<{ id: string }>;
  checkDeposits: (coin?: string) => Promise<{ found: number; credited: number; scanned: number }>;
  fetchTransactionHistory: (opts?: { page?: number; pageSize?: number; source?: "all" | "deposit" | "withdraw" }) => Promise<{ items: TxHistoryItem[]; hasMore: boolean; total: number }>;
  totalUsd: (priceMap: Record<string, number>) => number;
}

const DEFAULT_COINS = [
  "BTC","ETH","BNB","SOL","XRP","ADA","DOGE","AVAX","TRX","DOT",
  "MATIC","LINK","LTC","ATOM","UNI","NEAR","ARB","OP","APT","SUI",
  "INJ","USDT","USDC",
];

const Ctx = createContext<UserWalletCtx>({
  balances: [],
  loading: false,
  tradableCoins: DEFAULT_COINS,
  fetchBalances: async () => {},
  fetchTradableCoins: async () => {},
  getDepositAddress: async () => null,
  getDepositNetworks: async () => [],
  submitDepositRequest: async () => ({ id: "" }),
  submitWithdrawal: async () => ({ id: "" }),
  checkDeposits: async () => ({ found: 0, credited: 0, scanned: 0 }),
  fetchTransactionHistory: async () => ({ items: [], hasMore: false, total: 0 }),
  totalUsd: () => 0,
});

function authHeaders(userId: string): Record<string, string> {
  return { "Content-Type": "application/json", "x-user-id": userId };
}

export function UserWalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [tradableCoins, setTradableCoins] = useState<string[]>(DEFAULT_COINS);

  const fetchTradableCoins = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/wallet/tradable-coins`);
      const data = await res.json();
      if (Array.isArray(data.coins) && data.coins.length > 0) setTradableCoins(data.coins);
    } catch {}
  }, []);

  const fetchBalances = useCallback(async () => {
    if (!user?.id) { setBalances([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/wallet/balances`, {
        headers: authHeaders(user.id),
      });
      const data = await res.json();
      if (data.balances) setBalances(data.balances);
    } catch {}
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchTradableCoins();
    fetchBalances();
  }, [fetchTradableCoins, fetchBalances]);

  const getDepositAddress = useCallback(async (coin: string, network: string): Promise<DepositAddress | null> => {
    if (!user?.id) return null;
    try {
      const res = await fetch(
        `${API_BASE}/api/wallet/deposit-address/${coin}?network=${network}`,
        { headers: authHeaders(user.id) }
      );
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }, [user?.id]);

  const getDepositNetworks = useCallback(async (coin: string): Promise<DepositNetwork[]> => {
    if (!user?.id) return [];
    try {
      const res = await fetch(`${API_BASE}/api/wallet/deposit-networks/${coin}`, {
        headers: authHeaders(user.id),
      });
      const data = await res.json();
      return data.networks ?? [];
    } catch { return []; }
  }, [user?.id]);

  const submitDepositRequest = useCallback(async (req: DepositRequest): Promise<{ id: string }> => {
    if (!user?.id) throw new Error("Not logged in");
    const res = await fetch(`${API_BASE}/api/wallet/deposit-request`, {
      method: "POST",
      headers: authHeaders(user.id),
      body: JSON.stringify(req),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed");
    return data;
  }, [user?.id]);

  const submitWithdrawal = useCallback(async (req: WithdrawRequest): Promise<{ id: string }> => {
    if (!user?.id) throw new Error("Not logged in");
    const res = await fetch(`${API_BASE}/api/wallet/withdraw`, {
      method: "POST",
      headers: authHeaders(user.id),
      body: JSON.stringify(req),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed");
    await fetchBalances();
    return data;
  }, [user?.id, fetchBalances]);

  const fetchTransactionHistory = useCallback(async (
    opts: { page?: number; pageSize?: number; source?: "all" | "deposit" | "withdraw" } = {}
  ): Promise<{ items: TxHistoryItem[]; hasMore: boolean; total: number }> => {
    if (!user?.id) return { items: [], hasMore: false, total: 0 };
    try {
      const page = opts.page ?? 1;
      const pageSize = opts.pageSize ?? 20;
      const source = opts.source ?? "all";
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        source,
      });
      const res = await fetch(`${API_BASE}/api/wallet/transactions?${qs}`, {
        headers: authHeaders(user.id),
      });
      const data = await res.json();
      return {
        items: data.transactions ?? [],
        hasMore: data.hasMore ?? false,
        total: data.total ?? 0,
      };
    } catch { return { items: [], hasMore: false, total: 0 }; }
  }, [user?.id]);

  const checkDeposits = useCallback(async (coin?: string): Promise<{ found: number; credited: number; scanned: number }> => {
    if (!user?.id) throw new Error("Not logged in");
    const res = await fetch(`${API_BASE}/api/wallet/check-deposits`, {
      method: "POST",
      headers: authHeaders(user.id),
      body: JSON.stringify({ coin }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed");
    if (data.credited > 0) await fetchBalances();
    return { found: data.found ?? 0, credited: data.credited ?? 0, scanned: data.scanned ?? 0 };
  }, [user?.id, fetchBalances]);

  const totalUsd = useCallback((priceMap: Record<string, number>): number => {
    return balances.reduce((sum, b) => {
      const p = priceMap[b.coin] ?? 0;
      return sum + (b.available + b.locked) * p;
    }, 0);
  }, [balances]);

  return (
    <Ctx.Provider value={{ balances, loading, tradableCoins, fetchBalances, fetchTradableCoins, getDepositAddress, getDepositNetworks, submitDepositRequest, submitWithdrawal, checkDeposits, fetchTransactionHistory, totalUsd }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUserWallet() {
  return useContext(Ctx);
}
