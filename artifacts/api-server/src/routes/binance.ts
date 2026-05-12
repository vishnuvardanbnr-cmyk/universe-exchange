import { Router } from "express";
import crypto from "crypto";

const router = Router();

const BINANCE_BASE = "https://api.binance.com";

function sign(queryString: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(queryString).digest("hex");
}

function buildQueryString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

router.post("/binance/proxy", async (req, res) => {
  const { apiKey, apiSecret, method, path: apiPath, params = {} } = req.body as {
    apiKey: string;
    apiSecret: string;
    method: "GET" | "POST" | "DELETE";
    path: string;
    params?: Record<string, string>;
  };

  if (!apiKey || !apiSecret || !method || !apiPath) {
    res.status(400).json({ error: "Missing required fields: apiKey, apiSecret, method, path" });
    return;
  }

  try {
    const timestamp = Date.now().toString();
    const allParams: Record<string, string> = {
      ...params,
      recvWindow: "5000",
      timestamp,
    };

    const queryString = buildQueryString(allParams);
    const signature = sign(queryString, apiSecret);
    const signedQuery = `${queryString}&signature=${signature}`;

    const url =
      method === "GET" || method === "DELETE"
        ? `${BINANCE_BASE}${apiPath}?${signedQuery}`
        : `${BINANCE_BASE}${apiPath}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    if (method === "POST") {
      fetchOptions.body = signedQuery;
    }

    const binanceRes = await fetch(url, fetchOptions);
    const data = await binanceRes.json();

    res.status(binanceRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Binance proxy error", details: String(err) });
  }
});

export default router;
