import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBinance, BinanceBalance, BinanceOrder } from "./BinanceContext";
import { useKraken, KrakenBalance, KrakenOrder } from "./KrakenContext";

const STORAGE_KEY = "cryptox_active_exchange_v1";

export type ExchangeId = "binance" | "kraken";

export type UnifiedBalance = {
  asset: string;
  free: string;
  locked: string;
};

export type UnifiedOrder = {
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

export type ExchangeMeta = {
  id: ExchangeId;
  name: string;
  fullName: string;
  country: string;
  regulated: string;
  color: string;
  logo: string;
};

export const EXCHANGE_META: Record<ExchangeId, ExchangeMeta> = {
  binance: {
    id: "binance",
    name: "Binance",
    fullName: "Binance.com",
    country: "Cayman Islands",
    regulated: "Multiple global licenses",
    color: "#F0B90B",
    logo: "B",
  },
  kraken: {
    id: "kraken",
    name: "Kraken",
    fullName: "Kraken (Payward Inc.)",
    country: "United States",
    regulated: "FinCEN MSB, NY BitLicense, FCA UK",
    color: "#5741D9",
    logo: "K",
  },
};

type ActiveExchangeContextType = {
  activeExchange: ExchangeId;
  setActiveExchange: (id: ExchangeId) => Promise<void>;
  isConnected: boolean;
  placeOrder: (params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT" | "STOP_LOSS_LIMIT";
    quantity: string;
    price?: string;
    stopPrice?: string;
    timeInForce?: string;
  }) => Promise<UnifiedOrder | { error: string }>;
  getAccount: () => Promise<{ balances: UnifiedBalance[] } | null>;
  cancelOrder: (symbol: string, orderId: string) => Promise<{ success: boolean; error?: string }>;
  getOpenOrders: (symbol?: string) => Promise<UnifiedOrder[]>;
  meta: ExchangeMeta;
  binanceConnected: boolean;
  krakenConnected: boolean;
};

const ActiveExchangeContext = createContext<ActiveExchangeContextType | null>(null);

function toBinanceUnifiedOrder(o: BinanceOrder): UnifiedOrder {
  return {
    orderId: String(o.orderId),
    symbol: o.symbol,
    status: o.status,
    side: o.side,
    type: o.type,
    origQty: o.origQty,
    executedQty: o.executedQty,
    price: o.price,
    cummulativeQuoteQty: o.cummulativeQuoteQty,
    transactTime: o.transactTime ?? o.time,
  };
}

function toKrakenUnifiedOrder(o: KrakenOrder): UnifiedOrder {
  return {
    orderId: o.orderId,
    symbol: o.symbol,
    status: o.status,
    side: o.side,
    type: o.type,
    origQty: o.origQty,
    executedQty: o.executedQty,
    price: o.price,
    cummulativeQuoteQty: o.cummulativeQuoteQty,
    transactTime: o.transactTime,
  };
}

function toUnifiedBalance(b: BinanceBalance | KrakenBalance): UnifiedBalance {
  return { asset: b.asset, free: b.free, locked: b.locked };
}

export function ActiveExchangeProvider({ children }: { children: React.ReactNode }) {
  const [activeExchange, setActiveExchangeState] = useState<ExchangeId>("binance");
  const binance = useBinance();
  const kraken = useKraken();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw === "binance" || raw === "kraken") setActiveExchangeState(raw);
    });
  }, []);

  const setActiveExchange = useCallback(async (id: ExchangeId) => {
    await AsyncStorage.setItem(STORAGE_KEY, id);
    setActiveExchangeState(id);
  }, []);

  const isBinance = activeExchange === "binance";
  const isConnected = isBinance ? binance.isConnected : kraken.isConnected;
  const meta = EXCHANGE_META[activeExchange];

  const placeOrder = useCallback(async (params: Parameters<typeof binance.placeOrder>[0]): Promise<UnifiedOrder | { error: string }> => {
    if (isBinance) {
      const result = await binance.placeOrder(params);
      if ("error" in result) return result;
      return toBinanceUnifiedOrder(result as BinanceOrder);
    } else {
      const result = await kraken.placeOrder(params);
      if ("error" in result) return result;
      return toKrakenUnifiedOrder(result as KrakenOrder);
    }
  }, [isBinance, binance, kraken]);

  const getAccount = useCallback(async (): Promise<{ balances: UnifiedBalance[] } | null> => {
    const acct = isBinance ? await binance.getAccount() : await kraken.getAccount();
    if (!acct) return null;
    return { balances: acct.balances.map(toUnifiedBalance) };
  }, [isBinance, binance, kraken]);

  const cancelOrder = useCallback(async (symbol: string, orderId: string) => {
    return isBinance ? binance.cancelOrder(symbol, orderId) : kraken.cancelOrder(symbol, orderId);
  }, [isBinance, binance, kraken]);

  const getOpenOrders = useCallback(async (symbol?: string): Promise<UnifiedOrder[]> => {
    if (isBinance) {
      const orders = await binance.getOpenOrders(symbol);
      return orders.map(toBinanceUnifiedOrder);
    } else {
      const orders = await kraken.getOpenOrders(symbol);
      return orders.map(toKrakenUnifiedOrder);
    }
  }, [isBinance, binance, kraken]);

  return (
    <ActiveExchangeContext.Provider value={{
      activeExchange,
      setActiveExchange,
      isConnected,
      placeOrder,
      getAccount,
      cancelOrder,
      getOpenOrders,
      meta,
      binanceConnected: binance.isConnected,
      krakenConnected: kraken.isConnected,
    }}>
      {children}
    </ActiveExchangeContext.Provider>
  );
}

export function useActiveExchange() {
  const ctx = useContext(ActiveExchangeContext);
  if (!ctx) throw new Error("useActiveExchange must be used inside ActiveExchangeProvider");
  return ctx;
}
