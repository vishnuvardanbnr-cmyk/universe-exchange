import { Router } from "express";
import { logger } from "../lib/logger";

export interface EarnProduct {
  id: string;
  symbol: string;
  name: string;
  apy: number;
  minAmount: number;
  lockDays: number;
  type: "staking" | "liquid" | "earn";
  tag: string;
  active: boolean;
  createdAt: number;
}

let products: EarnProduct[] = [
  { id: "s1", symbol: "ETH", name: "Ethereum 2.0 Staking", apy: 4.2, minAmount: 0.01, lockDays: 0, type: "staking", tag: "Popular", active: true, createdAt: Date.now() },
  { id: "s2", symbol: "BNB", name: "BNB Staking", apy: 6.8, minAmount: 0.1, lockDays: 0, type: "staking", tag: "", active: true, createdAt: Date.now() },
  { id: "s3", symbol: "SOL", name: "Solana Staking", apy: 7.1, minAmount: 0.1, lockDays: 0, type: "staking", tag: "High APY", active: true, createdAt: Date.now() },
  { id: "s4", symbol: "DOT", name: "Polkadot Staking", apy: 12.4, minAmount: 1, lockDays: 28, type: "staking", tag: "", active: true, createdAt: Date.now() },
  { id: "s5", symbol: "ADA", name: "Cardano Staking", apy: 4.6, minAmount: 10, lockDays: 0, type: "staking", tag: "", active: true, createdAt: Date.now() },
  { id: "s6", symbol: "ATOM", name: "Cosmos Staking", apy: 19.2, minAmount: 1, lockDays: 21, type: "staking", tag: "Hot", active: true, createdAt: Date.now() },
  { id: "s7", symbol: "NEAR", name: "NEAR Staking", apy: 10.8, minAmount: 1, lockDays: 0, type: "staking", tag: "", active: true, createdAt: Date.now() },
  { id: "l1", symbol: "ETH", name: "stETH (Lido)", apy: 4.1, minAmount: 0.01, lockDays: 0, type: "liquid", tag: "Most Liquid", active: true, createdAt: Date.now() },
  { id: "l2", symbol: "SOL", name: "mSOL (Marinade)", apy: 6.9, minAmount: 0.1, lockDays: 0, type: "liquid", tag: "", active: true, createdAt: Date.now() },
  { id: "l3", symbol: "BNB", name: "WBETH (Wrapped)", apy: 5.2, minAmount: 0.01, lockDays: 0, type: "liquid", tag: "", active: true, createdAt: Date.now() },
  { id: "l4", symbol: "DOT", name: "lcDOT (Liquid)", apy: 11.8, minAmount: 1, lockDays: 0, type: "liquid", tag: "", active: true, createdAt: Date.now() },
  { id: "l5", symbol: "MATIC", name: "stMATIC (Lido)", apy: 5.4, minAmount: 1, lockDays: 0, type: "liquid", tag: "", active: true, createdAt: Date.now() },
  { id: "e1", symbol: "USDT", name: "USDT Flexible Savings", apy: 8.5, minAmount: 10, lockDays: 0, type: "earn", tag: "Flexible", active: true, createdAt: Date.now() },
  { id: "e2", symbol: "USDC", name: "USDC Flexible Savings", apy: 8.2, minAmount: 10, lockDays: 0, type: "earn", tag: "Flexible", active: true, createdAt: Date.now() },
  { id: "e3", symbol: "BTC", name: "BTC 30-Day Fixed", apy: 2.1, minAmount: 0.001, lockDays: 30, type: "earn", tag: "Fixed", active: true, createdAt: Date.now() },
  { id: "e4", symbol: "ETH", name: "ETH 90-Day Fixed", apy: 5.8, minAmount: 0.01, lockDays: 90, type: "earn", tag: "Fixed", active: true, createdAt: Date.now() },
  { id: "e5", symbol: "BNB", name: "BNB 60-Day Fixed", apy: 9.4, minAmount: 0.1, lockDays: 60, type: "earn", tag: "Fixed", active: true, createdAt: Date.now() },
  { id: "e6", symbol: "SOL", name: "SOL 30-Day Fixed", apy: 8.1, minAmount: 0.5, lockDays: 30, type: "earn", tag: "Fixed", active: true, createdAt: Date.now() },
  { id: "e7", symbol: "XRP", name: "XRP Flexible Savings", apy: 4.8, minAmount: 10, lockDays: 0, type: "earn", tag: "Flexible", active: true, createdAt: Date.now() },
];

const ADMIN_KEY = process.env["ADMIN_SECRET"] ?? "cryptox-admin-2024";

function isAdmin(req: any): boolean {
  return req.headers["x-admin-key"] === ADMIN_KEY;
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const router = Router();

router.get("/earn/products", (req, res) => {
  const { type } = req.query;
  const filtered = type
    ? products.filter((p) => p.type === type && p.active)
    : products.filter((p) => p.active);
  res.json({ products: filtered });
});

router.get("/earn/products/all", (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  res.json({ products });
});

router.post("/earn/products", (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { symbol, name, apy, minAmount, lockDays, type, tag } = req.body;
  if (!symbol || !name || apy == null || !type) {
    return res.status(400).json({ error: "Missing required fields: symbol, name, apy, type" });
  }
  if (!["staking", "liquid", "earn"].includes(type)) {
    return res.status(400).json({ error: "type must be staking, liquid, or earn" });
  }
  const product: EarnProduct = {
    id: genId(),
    symbol: String(symbol).toUpperCase(),
    name: String(name),
    apy: Number(apy),
    minAmount: Number(minAmount ?? 0),
    lockDays: Number(lockDays ?? 0),
    type: type as EarnProduct["type"],
    tag: String(tag ?? ""),
    active: true,
    createdAt: Date.now(),
  };
  products.push(product);
  logger.info({ product }, "Admin created earn product");
  res.status(201).json({ product });
});

router.put("/earn/products/:id", (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const idx = products.findIndex((p) => p.id === req.params["id"]);
  if (idx === -1) return res.status(404).json({ error: "Product not found" });
  const updates = req.body;
  products[idx] = { ...products[idx], ...updates, id: products[idx].id, createdAt: products[idx].createdAt };
  logger.info({ id: req.params["id"] }, "Admin updated earn product");
  res.json({ product: products[idx] });
});

router.delete("/earn/products/:id", (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const idx = products.findIndex((p) => p.id === req.params["id"]);
  if (idx === -1) return res.status(404).json({ error: "Product not found" });
  products[idx].active = false;
  logger.info({ id: req.params["id"] }, "Admin deactivated earn product");
  res.json({ success: true });
});

export default router;
