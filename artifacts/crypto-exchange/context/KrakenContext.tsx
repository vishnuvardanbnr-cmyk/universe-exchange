import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cryptox_kraken_creds_v1";

const API_BASE = (() => {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "http://localhost:8080";
})();

export type KrakenCredentials = {
  apiKey: string;
  apiSecret: string;
};

export type KrakenBalance = {
  asset: string;
  free: string;
  locked: string;
};

export type KrakenOrder = {
  orderId: string;
  symbol: string;
  status: string;
  side: string;
  type: string;
  origQty: string;
  executedQty: string;
  price: string;
  cummulativeQuoteQty: string;
  transactTime?: number;
};

const KRAKEN_TO_SYMBOL: Record<string, string> = {
  XXBT: "BTC", XETH: "ETH", XRP: "XRP", ADA: "ADA", SOL: "SOL",
  DOT: "DOT", LINK: "LINK", ATOM: "ATOM", LTC: "LTC", UNI: "UNI",
  NEAR: "NEAR", AVAX: "AVAX", TRX: "TRX", MATIC: "MATIC", DOGE: "DOGE",
  BNB: "BNB", OP: "OP", ARB: "ARB", APT: "APT", SUI: "SUI", INJ: "INJ",
  ZUSD: "USDT", USD: "USDT", EUR: "EUR",
};

const SYMBOL_TO_KRAKEN_PAIR: Record<string, string> = {
  BTC: "XBTUSD", ETH: "ETHUSD", XRP: "XRPUSD", ADA: "ADAUSD",
  SOL: "SOLUSD", DOT: "DOTUSD", LINK: "LINKUSD", ATOM: "ATOMUSD",
  LTC: "LTCUSD", UNI: "UNIUSD", NEAR: "NEARUSD", AVAX: "AVAXUSD",
  TRX: "TRXUSD", MATIC: "MATICUSD", DOGE: "XDGUSD",
  OP: "OPUSD", ARB: "ARBUSD", APT: "APTUSD", SUI: "SUIUSD", INJ: "INJUSD",
};

function normalizeAsset(krakenAsset: string): string {
  return KRAKEN_TO_SYMBOL[krakenAsset] ?? krakenAsset;
}

type KrakenContextType = {
  isConnected: boolean;
  credentials: KrakenCredentials | null;
  saveCredentials: (creds: KrakenCredentials) => Promise<void>;
  clearCredentials: () => Promise<void>;
  testConnection: (creds?: KrakenCredentials) => Promise<{ success: boolean; error?: string; balances?: KrakenBalance[] }>;
  getAccount: () => Promise<{ balances: KrakenBalance[] } | null>;
  placeOrder: (params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT" | "STOP_LOSS_LIMIT";
    quantity: string;
    price?: string;
    stopPrice?: string;
    timeInForce?: string;
  }) => Promise<KrakenOrder | { error: string }>;
  cancelOrder: (symbol: string, orderId: string) => Promise<{ success: boolean; error?: string }>;
  getOpenOrders: (symbol?: string) => Promise<KrakenOrder[]>;
};

const KrakenContext = createContext<KrakenContextType | null>(null);

export function KrakenProvider({ children }: { children: React.ReactNode }) {
  const [credentials, setCredentials] = useState<KrakenCredentials | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        const creds = JSON.parse(raw) as KrakenCredentials;
        setCredentials(creds);
        setIsConnected(true);
      }
    });
  }, []);

  const proxy = useCallback(async (
    path: string,
    params: Record<string, string> = {},
    creds?: KrakenCredentials
  ) => {
    const usedCreds = creds ?? credentials;
    if (!usedCreds) throw new Error("No Kraken credentials configured");

    const res = await fetch(`${API_BASE}/api/kraken/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: usedCreds.apiKey,
        apiSecret: usedCreds.apiSecret,
        path,
        params,
      }),
    });

    return res.json();
  }, [credentials]);

  const saveCredentials = useCallback(async (creds: KrakenCredentials) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
    setCredentials(creds);
    setIsConnected(true);
  }, []);

  const clearCredentials = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setCredentials(null);
    setIsConnected(false);
  }, []);

  const testConnection = useCallback(async (creds?: KrakenCredentials): Promise<{ success: boolean; error?: string; balances?: KrakenBalance[] }> => {
    try {
      const data = await proxy("/0/private/Balance", {}, creds);
      if (data.error && data.error.length > 0) {
        return { success: false, error: data.error[0] ?? "Invalid credentials" };
      }
      const result = data.result as Record<string, string> ?? {};
      const balances: KrakenBalance[] = Object.entries(result)
        .filter(([, v]) => parseFloat(v as string) > 0)
        .map(([k, v]) => ({
          asset: normalizeAsset(k),
          free: v as string,
          locked: "0",
        }));
      return { success: true, balances };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }, [proxy]);

  const getAccount = useCallback(async (): Promise<{ balances: KrakenBalance[] } | null> => {
    try {
      const data = await proxy("/0/private/Balance");
      if (data.error && data.error.length > 0) return null;
      const result = data.result as Record<string, string> ?? {};
      const balances: KrakenBalance[] = Object.entries(result)
        .filter(([, v]) => parseFloat(v as string) > 0)
        .map(([k, v]) => ({
          asset: normalizeAsset(k),
          free: v as string,
          locked: "0",
        }));
      return { balances };
    } catch {
      return null;
    }
  }, [proxy]);

  const placeOrder = useCallback(async (params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT" | "STOP_LOSS_LIMIT";
    quantity: string;
    price?: string;
    stopPrice?: string;
  }): Promise<KrakenOrder | { error: string }> => {
    try {
      const pair = SYMBOL_TO_KRAKEN_PAIR[params.symbol] ?? `${params.symbol}USD`;
      const orderType = params.type === "MARKET" ? "market" : params.type === "LIMIT" ? "limit" : "stop-loss-limit";
      const reqParams: Record<string, string> = {
        pair,
        type: params.side === "BUY" ? "buy" : "sell",
        ordertype: orderType,
        volume: params.quantity,
      };
      if (params.price && params.type !== "MARKET") {
        reqParams.price = params.price;
      }
      if (params.stopPrice) {
        reqParams.price2 = params.stopPrice;
      }

      const data = await proxy("/0/private/AddOrder", reqParams);
      if (data.error && data.error.length > 0) {
        return { error: data.error[0] ?? "Order failed" };
      }

      const txids = data.result?.txid as string[] ?? [];
      return {
        orderId: txids[0] ?? "unknown",
        symbol: params.symbol,
        status: "open",
        side: params.side,
        type: params.type,
        origQty: params.quantity,
        executedQty: params.type === "MARKET" ? params.quantity : "0",
        price: params.price ?? "0",
        cummulativeQuoteQty: "0",
        transactTime: Date.now(),
      } as KrakenOrder;
    } catch (err) {
      return { error: String(err) };
    }
  }, [proxy]);

  const cancelOrder = useCallback(async (_symbol: string, orderId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const data = await proxy("/0/private/CancelOrder", { txid: orderId });
      if (data.error && data.error.length > 0) {
        return { success: false, error: data.error[0] };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }, [proxy]);

  const getOpenOrders = useCallback(async (_symbol?: string): Promise<KrakenOrder[]> => {
    try {
      const data = await proxy("/0/private/OpenOrders");
      if (data.error && data.error.length > 0) return [];
      const orders = data.result?.open as Record<string, any> ?? {};
      return Object.entries(orders).map(([txid, o]: [string, any]) => ({
        orderId: txid,
        symbol: o.descr?.pair ?? "",
        status: "open",
        side: o.descr?.type === "buy" ? "BUY" : "SELL",
        type: o.descr?.ordertype?.toUpperCase() ?? "MARKET",
        origQty: o.vol ?? "0",
        executedQty: o.vol_exec ?? "0",
        price: o.descr?.price ?? "0",
        cummulativeQuoteQty: o.cost ?? "0",
        transactTime: Math.round((o.opentm ?? 0) * 1000),
      }));
    } catch {
      return [];
    }
  }, [proxy]);

  return (
    <KrakenContext.Provider value={{
      isConnected,
      credentials,
      saveCredentials,
      clearCredentials,
      testConnection,
      getAccount,
      placeOrder,
      cancelOrder,
      getOpenOrders,
    }}>
      {children}
    </KrakenContext.Provider>
  );
}

export function useKraken() {
  const ctx = useContext(KrakenContext);
  if (!ctx) throw new Error("useKraken must be used inside KrakenProvider");
  return ctx;
}
