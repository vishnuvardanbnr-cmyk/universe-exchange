import { Router } from "express";
import { getLatestTickers } from "../lib/priceSocket";

const router = Router();

router.get("/prices", (_req, res) => {
  const tickers = getLatestTickers();
  res.json({
    data: tickers,
    count: Object.keys(tickers).length,
    timestamp: Date.now(),
  });
});

export default router;
