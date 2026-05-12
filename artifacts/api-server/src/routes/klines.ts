import { Router } from "express";
import { getLatestTickers } from "../lib/priceSocket";

const router = Router();

const INTERVAL_MAP: Record<string, string> = {
  "15m": "15m",
  "1H": "1h",
  "4H": "4h",
  "1D": "1d",
  "1W": "1w",
};

const LIMIT_MAP: Record<string, number> = {
  "15m": 80,
  "1H": 80,
  "4H": 80,
  "1D": 90,
  "1W": 52,
};

const MS_MAP: Record<string, number> = {
  "15m": 15 * 60 * 1000,
  "1H": 60 * 60 * 1000,
  "4H": 4 * 60 * 60 * 1000,
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
};

const VOLATILITY_MAP: Record<string, number> = {
  "15m": 0.0025,
  "1H": 0.005,
  "4H": 0.010,
  "1D": 0.020,
  "1W": 0.040,
};

const FALLBACK_PRICES: Record<string, number> = {
  BTC: 71000, ETH: 2300, BNB: 600, SOL: 170, XRP: 0.55, ADA: 0.45,
  DOGE: 0.15, AVAX: 35, TRX: 0.12, DOT: 7, MATIC: 0.55, LINK: 14,
  LTC: 80, ATOM: 8, UNI: 8, NEAR: 5, ARB: 0.9, OP: 2.5, APT: 8, SUI: 1.1, INJ: 18,
};

function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = s ^ (s >>> 16);
    return (s >>> 0) / 4294967296;
  };
}

function generateCandles(baseSymbol: string, tf: string, limit: number, currentPrice: number) {
  const vol = VOLATILITY_MAP[tf] ?? 0.005;
  const msPerCandle = MS_MAP[tf] ?? 3600000;
  const now = Date.now();
  const seed = Math.floor(now / (msPerCandle * limit)) ^ (baseSymbol.charCodeAt(0) * 2654435761);
  const rand = seededRandom(seed);

  // Step 1: build close prices walking BACKWARDS from currentPrice → so closes[0]=oldest, closes[limit-1]=currentPrice
  const closes: number[] = new Array(limit);
  closes[limit - 1] = currentPrice;
  for (let i = limit - 2; i >= 0; i--) {
    const change = (rand() - 0.48) * vol * 2;   // slight upward drift
    closes[i] = closes[i + 1] / (1 + change);
  }

  // Step 2: build OHLC candles in time order (oldest → newest)
  return closes.map((close, i) => {
    const open = i === 0 ? close * (1 + (rand() - 0.5) * vol) : closes[i - 1];
    const body = Math.abs(close - open);
    const wickUp = body * (0.3 + rand() * 1.2);
    const wickDown = body * (0.3 + rand() * 1.2);
    const high = Math.max(open, close) + wickUp;
    const low  = Math.max(0.000001, Math.min(open, close) - wickDown);
    const t = now - (limit - i) * msPerCandle;
    const volume = currentPrice * (150 + rand() * 1200);
    return {
      t,
      o: +open.toFixed(8),
      h: +high.toFixed(8),
      l: +low.toFixed(8),
      c: +close.toFixed(8),
      v: +volume.toFixed(2),
    };
  });
}

router.get("/klines/:symbol", async (req, res) => {
  const baseSymbol = (req.params.symbol ?? "BTC").toUpperCase();
  const binanceSymbol = baseSymbol + "USDT";
  const tf = (req.query.interval as string) ?? "1H";
  const interval = INTERVAL_MAP[tf] ?? "1h";
  const limit = LIMIT_MAP[tf] ?? 80;

  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!response.ok) throw new Error(`Binance ${response.status}`);
    const raw: any[][] = await response.json();
    const candles = raw.map((k) => ({
      t: k[0], o: parseFloat(k[1]), h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]), v: parseFloat(k[5]),
    }));
    res.json({ symbol: binanceSymbol, interval: tf, candles, source: "binance" });
  } catch {
    const tickers = getLatestTickers();
    const livePrice = tickers[baseSymbol]?.price ?? FALLBACK_PRICES[baseSymbol] ?? 100;
    const candles = generateCandles(baseSymbol, tf, limit, livePrice);
    res.json({ symbol: binanceSymbol, interval: tf, candles, source: "simulated" });
  }
});

export default router;
