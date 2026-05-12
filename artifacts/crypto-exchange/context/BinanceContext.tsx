import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cryptox_binance_creds_v1";

const API_BASE = (() => {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "http://localhost:8080";
})();

export type BinanceCredentials = {
  apiKey: string;
  apiSecret: string;
};

export type BinanceBalance = {
  asset: string;
  free: string;
  locked: string;
};

export type BinanceOrder = {
  orderId: number;
  symbol: string;
  status: string;
  side: string;
  type: string;
  origQty: string;
  executedQty: string;
  price: string;
  cummulativeQuoteQty: string;
  transactTime?: number;
  time?: number;
};

type BinanceContextType = {
  isConnected: boolean;
  credentials: BinanceCredentials | null;
  saveCredentials: (creds: BinanceCredentials) => Promise<void>;
  clearCredentials: () => Promise<void>;
  testConnection: () => Promise<{ success: boolean; error?: string; balances?: BinanceBalance[] }>;
  getAccount: () => Promise<{ balances: BinanceBalance[] } | null>;
  placeOrder: (params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT" | "STOP_LOSS_LIMIT";
    quantity: string;
    price?: string;
    stopPrice?: string;
    timeInForce?: string;
  }) => Promise<BinanceOrder | { error: string }>;
  cancelOrder: (symbol: string, orderId: string) => Promise<{ success: boolean; error?: string }>;
  getOpenOrders: (symbol?: string) => Promise<BinanceOrder[]>;
};

const BinanceContext = createContext<BinanceContextType | null>(null);

export function BinanceProvider({ children }: { children: React.ReactNode }) {
  const [credentials, setCredentials] = useState<BinanceCredentials | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        const creds = JSON.parse(raw) as BinanceCredentials;
        setCredentials(creds);
        setIsConnected(true);
      }
    });
  }, []);

  const proxy = useCallback(async (
    method: "GET" | "POST" | "DELETE",
    path: string,
    params: Record<string, string> = {},
    creds?: BinanceCredentials
  ) => {
    const usedCreds = creds ?? credentials;
    if (!usedCreds) throw new Error("No Binance credentials configured");

    const res = await fetch(`${API_BASE}/api/binance/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: usedCreds.apiKey,
        apiSecret: usedCreds.apiSecret,
        method,
        path,
        params,
      }),
    });

    return res.json();
  }, [credentials]);

  const saveCredentials = useCallback(async (creds: BinanceCredentials) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
    setCredentials(creds);
    setIsConnected(true);
  }, []);

  const clearCredentials = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setCredentials(null);
    setIsConnected(false);
  }, []);

  const testConnection = useCallback(async (creds?: BinanceCredentials): Promise<{ success: boolean; error?: string; balances?: BinanceBalance[] }> => {
    try {
      const data = await proxy("GET", "/api/v3/account", {}, creds);
      if (data.code && data.code < 0) {
        return { success: false, error: data.msg ?? "Invalid API key or permissions" };
      }
      const nonZero = (data.balances as BinanceBalance[])?.filter(
        (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
      );
      return { success: true, balances: nonZero ?? [] };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }, [proxy]);

  const getAccount = useCallback(async (): Promise<{ balances: BinanceBalance[] } | null> => {
    try {
      const data = await proxy("GET", "/api/v3/account");
      if (data.code && data.code < 0) return null;
      return {
        balances: (data.balances as BinanceBalance[]).filter(
          (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
        ),
      };
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
    timeInForce?: string;
  }): Promise<BinanceOrder | { error: string }> => {
    try {
      const reqParams: Record<string, string> = {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity,
      };
      if (params.price) reqParams.price = params.price;
      if (params.stopPrice) reqParams.stopPrice = params.stopPrice;
      if (params.timeInForce) reqParams.timeInForce = params.timeInForce;
      if (params.type === "LIMIT" || params.type === "STOP_LOSS_LIMIT") {
        reqParams.timeInForce = params.timeInForce ?? "GTC";
      }

      const data = await proxy("POST", "/api/v3/order", reqParams);
      if (data.code && data.code < 0) {
        return { error: data.msg ?? "Order failed" };
      }
      return data as BinanceOrder;
    } catch (err) {
      return { error: String(err) };
    }
  }, [proxy]);

  const cancelOrder = useCallback(async (symbol: string, orderId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const data = await proxy("DELETE", "/api/v3/order", { symbol, orderId });
      if (data.code && data.code < 0) {
        return { success: false, error: data.msg };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }, [proxy]);

  const getOpenOrders = useCallback(async (symbol?: string): Promise<BinanceOrder[]> => {
    try {
      const params = symbol ? { symbol } : {};
      const data = await proxy("GET", "/api/v3/openOrders", params);
      if (!Array.isArray(data)) return [];
      return data as BinanceOrder[];
    } catch {
      return [];
    }
  }, [proxy]);

  return (
    <BinanceContext.Provider value={{
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
    </BinanceContext.Provider>
  );
}

export function useBinance() {
  const ctx = useContext(BinanceContext);
  if (!ctx) throw new Error("useBinance must be used inside BinanceProvider");
  return ctx;
}
