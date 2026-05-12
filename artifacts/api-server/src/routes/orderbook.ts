import { Router } from "express";
import { logger } from "../lib/logger";
import { getLatestTickers } from "../lib/priceSocket";

interface OrderBookLevel {
  price: number;
  amount: number;
  total: number;
}

interface OrderBookCache {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  fetchedAt: number;
  source: string;
}

const cache: Record<string, OrderBookCache> = {};
const CACHE_TTL_MS = 2000;

const SYMBOL_MAP: Record<string, string> = {
  BTC: "BTCUSDT", ETH: "ETHUSDT", BNB: "BNBUSDT", SOL: "SOLUSDT",
  XRP: "XRPUSDT", ADA: "ADAUSDT", DOGE: "DOGEUSDT", AVAX: "AVAXUSDT",
  TRX: "TRXUSDT", DOT: "DOTUSDT", MATIC: "MATICUSDT", LINK: "LINKUSDT",
  LTC: "LTCUSDT", ATOM: "ATOMUSDT", UNI: "UNIUSDT", NEAR: "NEARUSDT",
  ARB: "ARBUSDT", OP: "OPUSDT", APT: "APTUSDT", SUI: "SUIUSDT",
  INJ: "INJUSDT",
};

function generateFallback(symbol: string): OrderBookCache {
  const ticker = getLatestTickers()[symbol];
  const basePrice = ticker?.price ?? 1;
  const spread = basePrice * 0.0005;
  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];
  let bidTotal = 0, askTotal = 0;
  for (let i = 0; i < 15; i++) {
    const jitter = Math.random() * spread * 0.3;
    const bidPrice = basePrice - spread * (i + 1) - jitter;
    const bidAmt = parseFloat((Math.random() * 3 + 0.05).toFixed(4));
    bidTotal += bidAmt;
    bids.push({ price: bidPrice, amount: bidAmt, total: parseFloat(bidTotal.toFixed(4)) });
    const askPrice = basePrice + spread * (i + 1) + jitter;
    const askAmt = parseFloat((Math.random() * 3 + 0.05).toFixed(4));
    askTotal += askAmt;
    asks.push({ price: askPrice, amount: askAmt, total: parseFloat(askTotal.toFixed(4)) });
  }
  return { bids, asks, fetchedAt: Date.now(), source: "simulated" };
}

async function fetchBinanceOrderBook(symbol: string): Promise<OrderBookCache> {
  const pair = SYMBOL_MAP[symbol.toUpperCase()];
  if (!pair) throw new Error(`Unknown symbol: ${symbol}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const url = `https://api.binance.com/api/v3/depth?symbol=${pair}&limit=20`;
    const res = await fetch(url, { signal: controller.signal, headers: { "Accept": "application/json" } });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
    const data = (await res.json()) as { bids: [string, string][]; asks: [string, string][] };

    let bidTotal = 0;
    const bids: OrderBookLevel[] = data.bids.slice(0, 15).map(([p, a]) => {
      const price = parseFloat(p);
      const amount = parseFloat(a);
      bidTotal += amount;
      return { price, amount, total: parseFloat(bidTotal.toFixed(4)) };
    });

    let askTotal = 0;
    const asks: OrderBookLevel[] = data.asks.slice(0, 15).map(([p, a]) => {
      const price = parseFloat(p);
      const amount = parseFloat(a);
      askTotal += amount;
      return { price, amount, total: parseFloat(askTotal.toFixed(4)) };
    });

    return { bids, asks, fetchedAt: Date.now(), source: "binance" };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

const router = Router();

router.get("/orderbook/:symbol", async (req, res) => {
  const symbol = req.params["symbol"]?.toUpperCase() ?? "";
  if (!SYMBOL_MAP[symbol]) {
    return res.status(400).json({ error: `Unsupported symbol: ${symbol}` });
  }

  const cached = cache[symbol];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return res.json(cached);
  }

  try {
    const book = await fetchBinanceOrderBook(symbol);
    cache[symbol] = book;
    return res.json(book);
  } catch (err) {
    logger.warn({ err, symbol }, "Binance order book fetch failed, using fallback");
    const fallback = generateFallback(symbol);
    cache[symbol] = fallback;
    return res.json(fallback);
  }
});

export default router;
