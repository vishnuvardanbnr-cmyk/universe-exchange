import { Router } from "express";
import { query, queryOne } from "../lib/db";

const ADMIN_KEY = "cryptox-admin-2024";
const router = Router();

function requireAdmin(req: any, res: any): boolean {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

const P2P_ALL_COINS = ["USDT", "BTC", "ETH", "BNB", "SOL", "XRP"];

// GET /api/admin/p2p/settings
router.get("/admin/p2p/settings", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const row = await queryOne(`SELECT enabled_coins FROM p2p_settings WHERE id=1`);
    const enabled_coins = row?.enabled_coins ?? ["USDT"];
    res.json({ enabled_coins, all_coins: P2P_ALL_COINS });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/admin/p2p/settings
router.patch("/admin/p2p/settings", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { enabled_coins } = req.body;
  if (!Array.isArray(enabled_coins) || enabled_coins.length === 0) {
    return res.status(400).json({ error: "enabled_coins must be a non-empty array" });
  }
  const valid = (enabled_coins as string[]).filter(c => P2P_ALL_COINS.includes(c));
  if (valid.length === 0) return res.status(400).json({ error: "No valid coins provided" });
  try {
    await query(
      `INSERT INTO p2p_settings (id, enabled_coins, updated_at) VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE SET enabled_coins=$1, updated_at=NOW()`,
      [valid]
    );
    res.json({ ok: true, enabled_coins: valid });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── VERIFIED USERS ───────────────────────────────────────────────────────────

// GET /api/admin/p2p/verified-users
router.get("/admin/p2p/verified-users", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await query(`SELECT user_id, note, verified_at FROM p2p_verified_users ORDER BY verified_at DESC`);
    res.json({ users: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/p2p/users/:userId/verify
router.post("/admin/p2p/users/:userId/verify", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { note } = req.body;
  try {
    await query(
      `INSERT INTO p2p_verified_users (user_id, note) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET note=$2, verified_at=NOW()`,
      [req.params.userId, note ?? null]
    );
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/p2p/users/:userId/verify
router.delete("/admin/p2p/users/:userId/verify", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    await query(`DELETE FROM p2p_verified_users WHERE user_id=$1`, [req.params.userId]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/p2p/stats
router.get("/admin/p2p/stats", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [ads] = await query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='active') as active FROM p2p_ads`);
    const [orders] = await query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='disputed') as disputed, COUNT(*) FILTER (WHERE status='released') as completed FROM p2p_orders`);
    const [vol] = await query(`SELECT CAST(COALESCE(SUM(crypto_amount),0) AS FLOAT) as volume FROM p2p_orders WHERE status='released'`);
    res.json({ ads, orders, volume: vol.volume });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/p2p/ads
router.get("/admin/p2p/ads", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { status, coin, limit = "50", offset = "0" } = req.query as any;
  try {
    let sql = `SELECT id, user_id, type, coin, fiat_currency,
                      CAST(price AS FLOAT) as price,
                      CAST(min_amount AS FLOAT) as min_amount,
                      CAST(max_amount AS FLOAT) as max_amount,
                      CAST(available_amount AS FLOAT) as available_amount,
                      payment_methods, terms, status, created_at
               FROM p2p_ads WHERE 1=1`;
    const params: any[] = [];
    if (status) { params.push(status); sql += ` AND status=$${params.length}`; }
    if (coin) { params.push(coin.toUpperCase()); sql += ` AND coin=$${params.length}`; }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));
    const rows = await query(sql, params);
    res.json({ ads: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/admin/p2p/ads/:id/status
router.patch("/admin/p2p/ads/:id/status", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { status } = req.body;
  if (!["active","paused","admin_paused","deleted"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  try {
    await query(`UPDATE p2p_ads SET status=$1, updated_at=NOW() WHERE id=$2`, [status, parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/p2p/orders
router.get("/admin/p2p/orders", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { status, limit = "50", offset = "0" } = req.query as any;
  try {
    let sql = `SELECT o.id, o.ad_id, o.buyer_id, o.seller_id, o.coin,
                      CAST(o.crypto_amount AS FLOAT) as crypto_amount,
                      CAST(o.fiat_amount AS FLOAT) as fiat_amount,
                      CAST(o.price AS FLOAT) as price,
                      o.payment_method, o.status, o.dispute_reason, o.admin_note,
                      o.created_at, o.updated_at, a.type as ad_type
               FROM p2p_orders o LEFT JOIN p2p_ads a ON o.ad_id=a.id WHERE 1=1`;
    const params: any[] = [];
    if (status) { params.push(status); sql += ` AND o.status=$${params.length}`; }
    sql += ` ORDER BY o.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));
    const rows = await query(sql, params);
    res.json({ orders: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/p2p/orders/:id/resolve  — force-release or refund
router.post("/admin/p2p/orders/:id/resolve", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { action, note } = req.body; // action: "release" | "refund"
  if (!["release","refund"].includes(action)) {
    return res.status(400).json({ error: "action must be 'release' or 'refund'" });
  }
  try {
    const order = await queryOne(
      `SELECT * FROM p2p_orders WHERE id=$1 AND status IN ('disputed','paid','pending')`,
      [parseInt(req.params.id)]
    );
    if (!order) return res.status(404).json({ error: "Order not found or not resolvable" });
    const cryptoAmt = parseFloat(order.crypto_amount);

    if (action === "release") {
      // Release to buyer
      await query(
        `UPDATE user_balances SET locked = GREATEST(0, locked - $1), updated_at=NOW() WHERE user_id=$2 AND coin=$3`,
        [cryptoAmt, order.seller_id, order.coin]
      );
      await query(
        `INSERT INTO user_balances (user_id, coin, available, locked) VALUES ($1,$2,$3,0)
         ON CONFLICT (user_id, coin) DO UPDATE SET available=user_balances.available+$3, updated_at=NOW()`,
        [order.buyer_id, order.coin, cryptoAmt]
      );
    } else {
      // Refund to seller
      await query(
        `UPDATE user_balances SET available=available+$1, locked=GREATEST(0,locked-$1), updated_at=NOW()
         WHERE user_id=$2 AND coin=$3`,
        [cryptoAmt, order.seller_id, order.coin]
      );
      // Restore ad available_amount
      await query(
        `UPDATE p2p_ads SET available_amount=available_amount+$1, updated_at=NOW() WHERE id=$2`,
        [cryptoAmt, order.ad_id]
      );
    }
    await query(
      `UPDATE p2p_orders SET status='resolved', admin_note=$1, updated_at=NOW() WHERE id=$2`,
      [note ?? `Admin ${action}d`, order.id]
    );
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
