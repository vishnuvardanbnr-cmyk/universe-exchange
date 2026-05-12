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

// GET /api/admin/tradable-coins — list all coins with enabled status
router.get("/admin/tradable-coins", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await query(`SELECT coin, enabled, updated_at FROM tradable_coins ORDER BY coin`);
    res.json({ coins: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/tradable-coins/:coin — set enabled true/false
router.post("/admin/tradable-coins/:coin", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const coin = req.params.coin.toUpperCase();
  const { enabled } = req.body;
  if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled (boolean) required" });
  try {
    await query(
      `INSERT INTO tradable_coins (coin, enabled, label, updated_at)
       VALUES ($1, $2, $1, NOW())
       ON CONFLICT (coin) DO UPDATE SET enabled=$2, updated_at=NOW()`,
      [coin, enabled]
    );
    res.json({ ok: true, coin, enabled });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/user-deposit-addresses — all per-user unique addresses
router.get("/admin/user-deposit-addresses", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { coin } = req.query;
  try {
    const rows = coin
      ? await query(`SELECT * FROM user_deposit_addresses WHERE coin=$1 ORDER BY created_at DESC`, [String(coin).toUpperCase()])
      : await query(`SELECT * FROM user_deposit_addresses ORDER BY created_at DESC LIMIT 500`);
    res.json({ addresses: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/deposit-addresses — admin hot wallet addresses
router.get("/admin/deposit-addresses", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await query(`SELECT * FROM admin_deposit_addresses ORDER BY coin, network`);
    res.json({ addresses: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/deposit-addresses — upsert
router.post("/admin/deposit-addresses", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { coin, network, address, memo, label } = req.body;
  if (!coin || !network || !address) {
    return res.status(400).json({ error: "coin, network, address required" });
  }
  try {
    await query(
      `INSERT INTO admin_deposit_addresses (coin, network, address, memo, label)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (coin, network) DO UPDATE
         SET address=$3, memo=$4, label=$5`,
      [coin.toUpperCase(), network.toUpperCase(), address, memo ?? null, label ?? null]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/deposit-addresses/:coin/:network
router.delete("/admin/deposit-addresses/:coin/:network", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { coin, network } = req.params;
  try {
    await query(
      `DELETE FROM admin_deposit_addresses WHERE coin=$1 AND network=$2`,
      [coin.toUpperCase(), network.toUpperCase()]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users — list all users and their total balances
router.get("/admin/users", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await query(
      `SELECT user_id, json_agg(json_build_object('coin',coin,'available',CAST(available AS FLOAT),'locked',CAST(locked AS FLOAT))) as balances,
              SUM(CAST(available AS FLOAT) + CAST(locked AS FLOAT)) as total_balance
       FROM user_balances GROUP BY user_id ORDER BY total_balance DESC`
    );
    res.json({ users: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/deposits — pending deposit requests
router.get("/admin/deposits", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await query(
      `SELECT * FROM deposit_requests ORDER BY created_at DESC LIMIT 100`
    );
    res.json({ deposits: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/credit — credit a user's balance
router.post("/admin/credit", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { userId, coin, amount, depositId } = req.body;
  if (!userId || !coin || !amount) {
    return res.status(400).json({ error: "userId, coin, amount required" });
  }
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "Invalid amount" });

  try {
    await query(
      `INSERT INTO user_balances (user_id, coin, available, locked)
       VALUES ($1,$2,$3,0)
       ON CONFLICT (user_id, coin) DO UPDATE
         SET available = user_balances.available + $3, updated_at = NOW()`,
      [userId, coin.toUpperCase(), amt]
    );
    if (depositId) {
      await query(
        `UPDATE deposit_requests SET status='credited', updated_at=NOW(), note=COALESCE(note,'') || ' [credited]'
         WHERE id=$1`,
        [depositId]
      );
    }
    res.json({ ok: true, credited: amt, coin: coin.toUpperCase(), userId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/debit — debit a user's balance (for approved withdrawals)
router.post("/admin/debit", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { userId, coin, amount, withdrawalId } = req.body;
  if (!userId || !coin || !amount) {
    return res.status(400).json({ error: "userId, coin, amount required" });
  }
  const amt = parseFloat(amount);
  try {
    await query(
      `UPDATE user_balances SET locked = GREATEST(0, locked - $1), updated_at=NOW()
       WHERE user_id=$2 AND coin=$3`,
      [amt, userId, coin.toUpperCase()]
    );
    if (withdrawalId) {
      await query(
        `UPDATE withdrawal_requests SET status='approved', updated_at=NOW() WHERE id=$1`,
        [withdrawalId]
      );
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/withdrawals/:id/approve
router.post("/admin/withdrawals/:id/approve", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const row = await queryOne(`SELECT * FROM withdrawal_requests WHERE id=$1`, [id]);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.status !== "pending") return res.status(400).json({ error: `Already ${row.status}` });
    // deduct locked balance
    await query(
      `UPDATE user_balances SET locked = GREATEST(0, locked - $1), updated_at=NOW()
       WHERE user_id=$2 AND coin=$3`,
      [parseFloat(row.amount), row.user_id, row.coin]
    );
    await query(
      `UPDATE withdrawal_requests SET status='approved', updated_at=NOW() WHERE id=$1`,
      [id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/withdrawals
router.get("/admin/withdrawals", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await query(
      `SELECT * FROM withdrawal_requests ORDER BY created_at DESC LIMIT 100`
    );
    res.json({ withdrawals: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/withdrawals/:id/reject
router.post("/admin/withdrawals/:id/reject", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { reason } = req.body;
  try {
    const row = await queryOne<any>(`SELECT * FROM withdrawal_requests WHERE id=$1`, [id]);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.status === "rejected") return res.status(400).json({ error: "Already rejected" });
    // Return locked funds to available
    await query(
      `UPDATE user_balances SET
         locked = GREATEST(0, locked - $1),
         available = available + $1,
         updated_at = NOW()
       WHERE user_id=$2 AND coin=$3`,
      [parseFloat(row.amount), row.user_id, row.coin]
    );
    await query(
      `UPDATE withdrawal_requests SET status='rejected', note=COALESCE(note,'') || $2, updated_at=NOW() WHERE id=$1`,
      [id, reason ? ` [Rejected: ${reason}]` : " [Rejected]"]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/withdrawals/:id/process — mark as processed/broadcast
router.post("/admin/withdrawals/:id/process", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { tx_hash } = req.body;
  try {
    const row = await queryOne<any>(`SELECT * FROM withdrawal_requests WHERE id=$1`, [id]);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (!["pending", "approved"].includes(row.status)) {
      return res.status(400).json({ error: `Cannot process from status: ${row.status}` });
    }
    // Deduct locked balance
    await query(
      `UPDATE user_balances SET locked = GREATEST(0, locked - $1), updated_at=NOW()
       WHERE user_id=$2 AND coin=$3`,
      [parseFloat(row.amount), row.user_id, row.coin]
    );
    const finalHash = tx_hash ||
      "0x" + Array.from({length:64}, () => Math.floor(Math.random()*16).toString(16)).join("");
    await query(
      `UPDATE withdrawal_requests SET status='approved', note=COALESCE(note,'') || $2, updated_at=NOW() WHERE id=$1`,
      [id, ` [Processed: txhash=${finalHash}]`]
    );
    res.json({ ok: true, tx_hash: finalHash });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/set-balance — directly set a user's balance (for testing/manual adjustment)
router.post("/admin/set-balance", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { userId, coin, available, locked } = req.body;
  if (!userId || !coin) return res.status(400).json({ error: "userId and coin required" });
  try {
    await query(
      `INSERT INTO user_balances (user_id, coin, available, locked)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, coin) DO UPDATE
         SET available=$3, locked=$4, updated_at=NOW()`,
      [userId, coin.toUpperCase(), parseFloat(available ?? 0), parseFloat(locked ?? 0)]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
