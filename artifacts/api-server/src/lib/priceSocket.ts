import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { logger } from "./logger";

interface TickerData {
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

const TRACKED_SYMBOLS = [
  "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "AVAX", "TRX",
  "DOT", "MATIC", "LINK", "LTC", "ATOM", "UNI", "NEAR", "ARB", "OP",
  "APT", "SUI", "INJ",
];

let latestTickers: Record<string, TickerData> = {};
export function getLatestTickers(): Record<string, TickerData> { return latestTickers; }
let clients = new Set<WebSocket>();
let fastIntervalId: ReturnType<typeof setInterval> | null = null;
let slowIntervalId: ReturnType<typeof setInterval> | null = null;

function broadcast() {
  if (Object.keys(latestTickers).length === 0) return;
  const payload = JSON.stringify({ type: "snapshot", data: latestTickers });
  let sent = 0;
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sent++;
    }
  }
  if (sent > 0) logger.debug({ clients: sent }, "Price broadcast sent");
}

async function fetchCryptoCompareFull() {
  try {
    const fsyms = TRACKED_SYMBOLS.join(",");
    const url = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${fsyms}&tsyms=USD`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`CryptoCompare HTTP ${res.status}`);

    const json = (await res.json()) as any;
    const raw = json.RAW ?? {};

    let updated = 0;
    for (const sym of TRACKED_SYMBOLS) {
      const data = raw[sym]?.USD;
      if (!data) continue;

      const price = parseFloat(data.PRICE) || 0;
      if (price <= 0) continue;

      latestTickers[sym] = {
        symbol: sym,
        price,
        change24h: parseFloat(data.CHANGEPCT24HOUR) || 0,
        changeAmt24h: parseFloat(data.CHANGE24HOUR) || 0,
        high24h: parseFloat(data.HIGH24HOUR) || price,
        low24h: parseFloat(data.LOW24HOUR) || price,
        volume24h: parseFloat(data.VOLUME24HOUR) || 0,
        quoteVolume24h: parseFloat(data.VOLUME24HOURTO) || 0,
        lastUpdate: Date.now(),
      };
      updated++;
    }

    if (updated > 0) {
      broadcast();
      logger.info({ coins: updated }, "CryptoCompare full update applied");
    }
  } catch (err) {
    logger.warn({ err }, "CryptoCompare full update failed, falling back to Coinbase");
    await fetchCoinbasePrices();
  }
}

async function fetchCoinbasePrices() {
  try {
    const res = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=USD", {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) throw new Error(`Coinbase HTTP ${res.status}`);
    const json = (await res.json()) as any;
    const rates: Record<string, string> = json.data?.rates ?? {};

    let updated = 0;
    for (const sym of TRACKED_SYMBOLS) {
      const rate = rates[sym];
      if (!rate) continue;
      const price = 1 / parseFloat(rate);
      if (!isFinite(price) || price <= 0) continue;

      const prev = latestTickers[sym];
      latestTickers[sym] = {
        symbol: sym,
        price,
        change24h: prev?.change24h ?? 0,
        changeAmt24h: prev?.changeAmt24h ?? 0,
        high24h: prev?.high24h ?? price,
        low24h: prev?.low24h ?? price,
        volume24h: prev?.volume24h ?? 0,
        quoteVolume24h: prev?.quoteVolume24h ?? 0,
        lastUpdate: Date.now(),
      };
      updated++;
    }

    if (updated > 0) {
      broadcast();
      logger.debug({ coins: updated }, "Coinbase price update applied");
    }
  } catch (err) {
    logger.warn({ err }, "Coinbase price fetch failed");
  }
}

export function setupPriceWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/api/ws/prices" });

  wss.on("connection", (ws) => {
    clients.add(ws);
    logger.info({ totalClients: clients.size }, "Client connected to price feed");

    if (Object.keys(latestTickers).length > 0) {
      ws.send(JSON.stringify({ type: "snapshot", data: latestTickers }));
    }

    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
  });

  fetchCryptoCompareFull();
  slowIntervalId = setInterval(fetchCryptoCompareFull, 10000);

  fastIntervalId = setInterval(fetchCoinbasePrices, 5000);

  logger.info("Price WebSocket ready at /api/ws/prices (CryptoCompare 10s + Coinbase 5s)");
}
