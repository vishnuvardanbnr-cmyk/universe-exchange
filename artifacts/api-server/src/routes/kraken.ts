import { Router } from "express";
import crypto from "crypto";
import qs from "querystring";

const router = Router();

const KRAKEN_BASE = "https://api.kraken.com";

function krakenSign(path: string, nonce: string, postData: string, apiSecret: string): string {
  const sha256Hash = crypto.createHash("sha256").update(nonce + postData).digest();
  const message = Buffer.concat([Buffer.from(path), sha256Hash]);
  const secretBuf = Buffer.from(apiSecret, "base64");
  return crypto.createHmac("sha512", secretBuf).update(message).digest("base64");
}

router.post("/kraken/proxy", async (req, res) => {
  const { apiKey, apiSecret, path: apiPath, params = {} } = req.body as {
    apiKey: string;
    apiSecret: string;
    path: string;
    params?: Record<string, string>;
  };

  if (!apiKey || !apiSecret || !apiPath) {
    res.status(400).json({ error: "Missing required fields: apiKey, apiSecret, path" });
    return;
  }

  try {
    const nonce = Date.now().toString();
    const postParams: Record<string, string> = { nonce, ...params };
    const postData = qs.stringify(postParams);
    const signature = krakenSign(apiPath, nonce, postData, apiSecret);

    const krakenRes = await fetch(`${KRAKEN_BASE}${apiPath}`, {
      method: "POST",
      headers: {
        "API-Key": apiKey,
        "API-Sign": signature,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: postData,
    });

    const data = await krakenRes.json();
    res.status(krakenRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Kraken proxy error", details: String(err) });
  }
});

export default router;
