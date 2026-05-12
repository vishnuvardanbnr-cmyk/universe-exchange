import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

export interface LiveTicker {
  symbol: string;
  price: number;
  change24h: number;
  changeAmt24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  lastUpdate: number;
}

interface LivePriceContextType {
  tickers: Record<string, LiveTicker>;
  connected: boolean;
  connectionMode: "websocket" | "polling" | "disconnected";
  getPrice: (symbol: string) => number;
  getChange: (symbol: string) => number;
  getTicker: (symbol: string) => LiveTicker | null;
}

const LivePriceContext = createContext<LivePriceContextType>({
  tickers: {},
  connected: false,
  connectionMode: "disconnected",
  getPrice: () => 0,
  getChange: () => 0,
  getTicker: () => null,
});

const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";

function getWsUrl() {
  if (domain) return `wss://${domain}/api/ws/prices`;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/ws/prices`;
  }
  return null;
}

function getRestUrl() {
  if (domain) return `https://${domain}/api/prices`;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/api/prices`;
  }
  return null;
}

export function LivePriceProvider({ children }: { children: React.ReactNode }) {
  const [tickers, setTickers] = useState<Record<string, LiveTicker>>({});
  const [connected, setConnected] = useState(false);
  const [connectionMode, setConnectionMode] = useState<"websocket" | "polling" | "disconnected">("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsFailedRef = useRef(false);

  const applySnapshot = (data: Record<string, LiveTicker>) => {
    setTickers((prev) => ({ ...prev, ...data }));
    setConnected(true);
  };

  const applyTicker = (ticker: LiveTicker) => {
    setTickers((prev) => ({ ...prev, [ticker.symbol]: ticker }));
    setConnected(true);
  };

  const startRestPolling = useCallback(() => {
    if (pollTimer.current) return;
    const restUrl = getRestUrl();
    if (!restUrl) return;

    setConnectionMode("polling");

    const poll = async () => {
      try {
        const res = await fetch(restUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.data && Object.keys(json.data).length > 0) {
          applySnapshot(json.data);
          setConnected(true);
        }
      } catch {
        setConnected(false);
      }
    };

    poll();
    pollTimer.current = setInterval(poll, 3000);
  }, []);

  const connectWebSocket = useCallback(() => {
    const wsUrl = getWsUrl();
    if (!wsUrl) {
      startRestPolling();
      return;
    }

    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setConnectionMode("websocket");

    const failTimer = setTimeout(() => {
      if (!connected && !wsFailedRef.current) {
        wsFailedRef.current = true;
        ws.close();
        startRestPolling();
      }
    }, 6000);

    ws.onopen = () => {
      clearTimeout(failTimer);
      wsFailedRef.current = false;
      setConnected(true);
      setConnectionMode("websocket");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "snapshot" && msg.data) {
          applySnapshot(msg.data);
        } else if (msg.type === "ticker" && msg.data) {
          applyTicker(msg.data);
        }
      } catch {}
    };

    ws.onerror = () => {
      clearTimeout(failTimer);
      setConnected(false);
      if (!wsFailedRef.current) {
        wsFailedRef.current = true;
        startRestPolling();
      }
    };

    ws.onclose = () => {
      clearTimeout(failTimer);
      setConnected(false);
      if (!wsFailedRef.current) {
        reconnectTimer.current = setTimeout(connectWebSocket, 5000);
      }
    };
  }, [startRestPolling]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pollTimer.current) clearInterval(pollTimer.current);
      wsRef.current?.close();
    };
  }, []);

  const getPrice = useCallback((symbol: string): number => {
    return tickers[symbol]?.price ?? 0;
  }, [tickers]);

  const getChange = useCallback((symbol: string): number => {
    return tickers[symbol]?.change24h ?? 0;
  }, [tickers]);

  const getTicker = useCallback((symbol: string): LiveTicker | null => {
    return tickers[symbol] ?? null;
  }, [tickers]);

  return (
    <LivePriceContext.Provider value={{ tickers, connected, connectionMode, getPrice, getChange, getTicker }}>
      {children}
    </LivePriceContext.Provider>
  );
}

export function useLivePrice() {
  return useContext(LivePriceContext);
}
