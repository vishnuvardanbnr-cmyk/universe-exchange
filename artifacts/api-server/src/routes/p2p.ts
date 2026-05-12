import { Router } from "express";
import { query, queryOne } from "../lib/db";

const router = Router();

function requireUser(req: any, res: any): string | null {
  const userId = (req.headers["x-user-id"] as string)?.trim();
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return userId;
}

function merchant(userId: string) {
  return "Trader_" + userId.slice(0, 6).toUpperCase();
}

// Auto-cancel any expired pending orders. Returns affected ids.
// Refunds locked crypto to seller and restores ad available_amount.
async function expireStalePendingOrders(): Promise<number[]> {
  try {
    const stale = await query(
      `SELECT id, ad_id, seller_id, coin, crypto_amount
       FROM p2p_orders
       WHERE status='pending'
         AND created_at + (payment_window_minutes || ' minutes')::interval < NOW()`
    );
    for (const o of stale) {
      await query(
        `UPDATE user_balances SET available = available + $1, locked = GREATEST(0, locked - $1), updated_at=NOW()
         WHERE user_id=$2 AND coin=$3`,
        [o.crypto_amount, o.seller_id, o.coin]
      );
      await query(
        `UPDATE p2p_ads SET available_amount = available_amount + $1, updated_at=NOW() WHERE id=$2`,
        [o.crypto_amount, o.ad_id]
      );
      await query(
        `UPDATE p2p_orders SET status='cancelled', admin_note=COALESCE(admin_note,'') || ' [auto-cancelled: payment window expired]', updated_at=NOW()
         WHERE id=$1`,
        [o.id]
      );
    }
    return stale.map((s: any) => s.id);
  } catch { return []; }
}

// ─── CONFIG (public) ──────────────────────────────────────────────────────────

// GET /api/p2p/config  —  returns enabled coins for P2P
router.get("/p2p/config", async (_req, res) => {
  try {
    const row = await queryOne(`SELECT enabled_coins FROM p2p_settings WHERE id=1`);
    res.json({ enabled_coins: row?.enabled_coins ?? ["USDT"] });
  } catch {
    res.json({ enabled_coins: ["USDT"] });
  }
});

// ─── PAYMENT DETAILS ──────────────────────────────────────────────────────────

// GET /api/p2p/payment-details  —  fetch user's saved payment details
router.get("/p2p/payment-details", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const rows = await query(
      `SELECT method, details FROM p2p_payment_details WHERE user_id = $1`,
      [userId]
    );
    const result: Record<string, any> = {};
    for (const row of rows) result[row.method] = row.details;
    res.json({ details: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/p2p/payment-details  —  save/update payment details for a method
router.put("/p2p/payment-details", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const { method, details } = req.body;
  if (!method || typeof details !== "object") {
    return res.status(400).json({ error: "method and details required" }) as any;
  }
  try {
    await query(
      `INSERT INTO p2p_payment_details (user_id, method, details, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, method) DO UPDATE SET details = $3, updated_at = NOW()`,
      [userId, method, JSON.stringify(details)]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ADS ──────────────────────────────────────────────────────────────────────

// GET /api/p2p/ads  —  browse ads (public-ish)
router.get("/p2p/ads", async (req, res) => {
  const { type, coin, payment, limit = "30", offset = "0" } = req.query as any;
  try {
    let sql = `
      SELECT pa.id, pa.user_id, pa.type, pa.coin, pa.fiat_currency,
             CAST(pa.price AS FLOAT) as price,
             CAST(pa.min_amount AS FLOAT) as min_amount,
             CAST(pa.max_amount AS FLOAT) as max_amount,
             CAST(pa.available_amount AS FLOAT) as available_amount,
             pa.payment_methods, pa.terms, pa.status, pa.created_at,
             (pv.user_id IS NOT NULL) as verified
      FROM p2p_ads pa
      LEFT JOIN p2p_verified_users pv ON pa.user_id = pv.user_id
      WHERE pa.status = 'active'
    `;
    const params: any[] = [];
    if (type) { params.push(type); sql += ` AND pa.type = $${params.length}`; }
    if (coin) { params.push(coin.toUpperCase()); sql += ` AND pa.coin = $${params.length}`; }
    if (payment) { params.push(payment); sql += ` AND $${params.length} = ANY(pa.payment_methods)`; }
    sql += ` ORDER BY pv.user_id IS NOT NULL DESC, pa.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    const rows = await query(sql, params);
    res.json({
      ads: rows.map(r => ({
        ...r,
        merchant: merchant(r.user_id),
        orders: Math.floor(Math.random() * 800) + 50,
        completion: (95 + Math.random() * 4.9).toFixed(1) + "%",
      }))
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/p2p/ads/mine  — my ads
router.get("/p2p/ads/mine", async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  try {
    const rows = await query(
      `SELECT id, type, coin, fiat_currency,
              CAST(price AS FLOAT) as price,
              CAST(min_amount AS FLOAT) as min_amount,
              CAST(max_amount AS FLOAT) as max_amount,
              CAST(available_amount AS FLOAT) as available_amount,
              payment_methods, terms, status, created_at
       FROM p2p_ads WHERE user_id = $1 AND status != 'deleted'
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ ads: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/p2p/ads  — create ad
router.post("/p2p/ads", async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const { type, coin, price, min_amount, max_amount, available_amount, payment_methods, terms, fiat_currency = "USD" } = req.body;
  if (!type || !coin || !price || !min_amount || !max_amount || !available_amount) {
    return res.status(400).json({ error: "type, coin, price, min_amount, max_amount, available_amount required" });
  }
  if (type === "sell") {
    // Lock the available_amount from seller's balance
    const bal = await queryOne(
      `SELECT CAST(available AS FLOAT) as available FROM user_balances WHERE user_id=$1 AND coin=$2`,
      [userId, coin.toUpperCase()]
    );
    if (!bal || bal.available < parseFloat(available_amount)) {
      return res.status(400).json({ error: "Insufficient balance to create sell ad" });
    }
    await query(
      `UPDATE user_balances SET available = available - $1, locked = locked + $1, updated_at = NOW()
       WHERE user_id = $2 AND coin = $3`,
      [available_amount, userId, coin.toUpperCase()]
    );
  }
  try {
    const [ad] = await query(
      `INSERT INTO p2p_ads (user_id, type, coin, fiat_currency, price, min_amount, max_amount, available_amount, payment_methods, terms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [userId, type, coin.toUpperCase(), fiat_currency, price, min_amount, max_amount, available_amount,
       Array.isArray(payment_methods) ? payment_methods : [payment_methods], terms ?? null]
    );
    res.json({ ok: true, id: ad.id });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/p2p/ads/:id/toggle  — pause / resume my ad
router.patch("/p2p/ads/:id/toggle", async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const id = parseInt(req.params.id);
  try {
    const ad = await queryOne(`SELECT * FROM p2p_ads WHERE id=$1 AND user_id=$2`, [id, userId]);
    if (!ad) return res.status(404).json({ error: "Ad not found" });
    const next = ad.status === "active" ? "paused" : "active";
    await query(`UPDATE p2p_ads SET status=$1, updated_at=NOW() WHERE id=$2`, [next, id]);
    res.json({ ok: true, status: next });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/p2p/ads/:id  — soft-delete my ad and return locked funds
router.delete("/p2p/ads/:id", async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const id = parseInt(req.params.id);
  try {
    const ad = await queryOne(`SELECT * FROM p2p_ads WHERE id=$1 AND user_id=$2 AND status != 'deleted'`, [id, userId]);
    if (!ad) return res.status(404).json({ error: "Ad not found" });
    await query(`UPDATE p2p_ads SET status='deleted', updated_at=NOW() WHERE id=$1`, [id]);
    if (ad.type === "sell" && parseFloat(ad.available_amount) > 0) {
      await query(
        `UPDATE user_balances SET available = available + $1, locked = GREATEST(0, locked - $1), updated_at = NOW()
         WHERE user_id = $2 AND coin = $3`,
        [ad.available_amount, userId, ad.coin]
      );
    }
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── ORDERS ───────────────────────────────────────────────────────────────────

// POST /api/p2p/orders  — place order against an ad
router.post("/p2p/orders", async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const { ad_id, crypto_amount, payment_method } = req.body;
  if (!ad_id || !crypto_amount || !payment_method) {
    return res.status(400).json({ error: "ad_id, crypto_amount, payment_method required" });
  }
  try {
    const ad = await queryOne(
      `SELECT * FROM p2p_ads WHERE id=$1 AND status='active'`,
      [parseInt(ad_id)]
    );
    if (!ad) return res.status(404).json({ error: "Ad not found or inactive" });
    if (ad.user_id === userId) return res.status(400).json({ error: "Cannot trade with yourself" });

    const cryptoAmt = parseFloat(crypto_amount);
    const fiatAmt = cryptoAmt * parseFloat(ad.price);

    if (cryptoAmt < parseFloat(ad.min_amount) || cryptoAmt > parseFloat(ad.max_amount)) {
      return res.status(400).json({ error: `Amount must be between ${ad.min_amount} and ${ad.max_amount} ${ad.coin}` });
    }
    if (cryptoAmt > parseFloat(ad.available_amount)) {
      return res.status(400).json({ error: "Insufficient amount available in ad" });
    }

    let buyerId: string, sellerId: string;
    if (ad.type === "sell") {
      buyerId = userId;
      sellerId = ad.user_id;
    } else {
      buyerId = ad.user_id;
      sellerId = userId;
      // Lock seller (user placing order against buy ad) funds
      const bal = await queryOne(
        `SELECT CAST(available AS FLOAT) as available FROM user_balances WHERE user_id=$1 AND coin=$2`,
        [userId, ad.coin]
      );
      if (!bal || bal.available < cryptoAmt) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      await query(
        `UPDATE user_balances SET available = available - $1, locked = locked + $1, updated_at = NOW()
         WHERE user_id = $2 AND coin = $3`,
        [cryptoAmt, userId, ad.coin]
      );
    }

    // Deduct from ad's available_amount
    await query(
      `UPDATE p2p_ads SET available_amount = available_amount - $1, updated_at = NOW() WHERE id = $2`,
      [cryptoAmt, ad.id]
    );

    const [order] = await query(
      `INSERT INTO p2p_orders (ad_id, buyer_id, seller_id, coin, crypto_amount, fiat_amount, price, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [ad.id, buyerId, sellerId, ad.coin, cryptoAmt, fiatAmt, ad.price, payment_method]
    );
    res.json({ ok: true, order_id: order.id });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/p2p/orders  — my orders (as buyer or seller)
router.get("/p2p/orders", async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const { role } = req.query as any;
  try {
    await expireStalePendingOrders();
    let where = `(buyer_id=$1 OR seller_id=$1)`;
    if (role === "buyer") where = `buyer_id=$1`;
    if (role === "seller") where = `seller_id=$1`;
    const rows = await query(
      `SELECT o.id, o.ad_id, o.buyer_id, o.seller_id, o.coin,
              CAST(o.crypto_amount AS FLOAT) as crypto_amount,
              CAST(o.fiat_amount AS FLOAT) as fiat_amount,
              CAST(o.price AS FLOAT) as price,
              o.payment_method, o.status, o.dispute_reason, o.admin_note,
              o.payment_proof, o.payment_window_minutes, o.paid_at,
              o.created_at, o.updated_at,
              a.type as ad_type
       FROM p2p_orders o LEFT JOIN p2p_ads a ON o.ad_id = a.id
       WHERE ${where} ORDER BY o.created_at DESC`,
      [userId]
    );
    res.json({ orders: rows.map(r => ({ ...r, is_buyer: r.buyer_id === userId })) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/p2p/orders/:id
router.get("/p2p/orders/:id", async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  try {
    await expireStalePendingOrders();
    const order = await queryOne(
      `SELECT o.id, o.ad_id, o.buyer_id, o.seller_id, o.coin,
              CAST(o.crypto_amount AS FLOAT) as crypto_amount,
              CAST(o.fiat_amount AS FLOAT) as fiat_amount,
              CAST(o.price AS FLOAT) as price,
              o.payment_method, o.status, o.dispute_reason, o.admin_note,
              o.payment_proof, o.payment_window_minutes, o.paid_at,
              o.created_at, o.updated_at, a.type as ad_type,
              a.payment_methods as ad_payment_methods, a.terms
       FROM p2p_orders o LEFT JOIN p2p_ads a ON o.ad_id = a.id
       WHERE o.id = $1 AND (o.buyer_id=$2 OR o.seller_id=$2)`,
      [parseInt(req.params.id), userId]
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ order: { ...order, is_buyer: order.buyer_id === userId } });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/p2p/orders/:id/pay  — buyer marks as paid (with optional payment proof note/url)
router.post("/p2p/orders/:id/pay", async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const { payment_proof } = req.body ?? {};
  try {
    await expireStalePendingOrders();
    const order = await queryOne(
      `SELECT * FROM p2p_orders WHERE id=$1 AND buyer_id=$2 AND status='pending'`,
      [parseInt(req.params.id), userId]
    );
    if (!order) return res.status(404).json({ error: "Order not found, expired, or not in pending state" });
    // Defensive: still verify window
    const expiresAt = new Date(order.created_at).getTime() + (order.payment_window_minutes ?? 15) * 60_000;
    if (Date.now() > expiresAt) {
      return res.status(400).json({ error: "Payment window has expired. Please place a new order." });
    }
    await query(
      `UPDATE p2p_orders SET status='paid', payment_proof=$1, paid_at=NOW(), updated_at=NOW() WHERE id=$2`,
      [payment_proof ?? null, order.id]
    );
    // System message in chat for seller visibility
    await query(
      `INSERT INTO p2p_messages (order_id, sender_id, message) VALUES ($1,$2,$3)`,
      [order.id, userId, `[Payment marked as sent]${payment_proof ? `\nReference: ${payment_proof}` : ""}`]
    );
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/p2p/orders/:id/seller-payment  — buyer fetches seller's payment account details
router.get("/p2p/orders/:id/seller-payment", async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  try {
    const order = await queryOne(
      `SELECT seller_id, payment_method FROM p2p_orders WHERE id=$1 AND buyer_id=$2`,
      [parseInt(req.params.id), userId]
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    const row = await queryOne(
      `SELECT details FROM p2p_payment_details WHERE user_id=$1 AND method=$2`,
      [order.seller_id, order.payment_method]
    );
    res.json({
      method: order.payment_method,
      details: row?.details ?? null,
      seller_name: merchant(order.seller_id),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/p2p/orders/:id/release  — seller releases crypto to buyer
router.post("/p2p/orders/:id/release", async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  try {
    const order = await queryOne(
      `SELECT * FROM p2p_orders WHERE id=$1 AND seller_id=$2 AND status IN ('paid','disputed')`,
      [parseInt(req.params.id), userId]
    );
    if (!order) return res.status(404).json({ error: "Order not found or not in paid/disputed state" });
    const cryptoAmt = parseFloat(order.crypto_amount);
    // Deduct from seller's locked, add to buyer's available
    await query(
      `UPDATE user_balances SET locked = GREATEST(0, locked - $1), updated_at = NOW()
       WHERE user_id = $2 AND coin = $3`,
      [cryptoAmt, order.seller_id, order.coin]
    );
    await query(
      `INSERT INTO user_balances (user_id, coin, available, locked)
       VALUES ($1,$2,$3,0)
       ON CONFLICT (user_id, coin) DO UPDATE SET available = user_balances.available + $3, updated_at = NOW()`,
      [order.buyer_id, order.coin, cryptoAmt]
    );
    await query(`UPDATE p2p_orders SET status='released', updated_at=NOW() WHERE id=$1`, [order.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/p2p/orders/:id/cancel
router.post("/p2p/orders/:id/cancel", async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  try {
    const order = await queryOne(
      `SELECT * FROM p2p_orders WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2) AND status='pending'`,
      [parseInt(req.params.id), userId]
    );
    if (!order) return res.status(404).json({ error: "Order not found or cannot be cancelled" });
    const cryptoAmt = parseFloat(order.crypto_amount);
    // Return locked funds to seller
    await query(
      `UPDATE user_balances SET available = available + $1, locked = GREATEST(0, locked - $1), updated_at = NOW()
       WHERE user_id = $2 AND coin = $3`,
      [cryptoAmt, order.seller_id, order.coin]
    );
    // Restore ad available_amount
    await query(
      `UPDATE p2p_ads SET available_amount = available_amount + $1, updated_at = NOW() WHERE id = $2`,
      [cryptoAmt, order.ad_id]
    );
    await query(`UPDATE p2p_orders SET status='cancelled', updated_at=NOW() WHERE id=$1`, [order.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/p2p/orders/:id/dispute
router.post("/p2p/orders/:id/dispute", async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const { reason } = req.body;
  try {
    const order = await queryOne(
      `SELECT * FROM p2p_orders WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2) AND status IN ('pending','paid')`,
      [parseInt(req.params.id), userId]
    );
    if (!order) return res.status(404).json({ error: "Order not found or cannot dispute" });
    await query(
      `UPDATE p2p_orders SET status='disputed', dispute_reason=$1, updated_at=NOW() WHERE id=$2`,
      [reason ?? "No reason provided", order.id]
    );
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/p2p/orders/:id/messages
router.get("/p2p/orders/:id/messages", async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  try {
    const order = await queryOne(
      `SELECT id FROM p2p_orders WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)`,
      [parseInt(req.params.id), userId]
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    const msgs = await query(
      `SELECT id, sender_id, message, created_at FROM p2p_messages WHERE order_id=$1 ORDER BY created_at ASC`,
      [order.id]
    );
    res.json({ messages: msgs.map(m => ({ ...m, is_me: m.sender_id === userId })) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/p2p/orders/:id/messages
router.post("/p2p/orders/:id/messages", async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "message required" });
  try {
    const order = await queryOne(
      `SELECT id FROM p2p_orders WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2) AND status NOT IN ('released','cancelled','resolved')`,
      [parseInt(req.params.id), userId]
    );
    if (!order) return res.status(404).json({ error: "Order not found or closed" });
    await query(
      `INSERT INTO p2p_messages (order_id, sender_id, message) VALUES ($1,$2,$3)`,
      [order.id, userId, message.trim()]
    );
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
