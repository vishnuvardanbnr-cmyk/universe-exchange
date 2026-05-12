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

// ─── LIQUIDITY WALLETS ─────────────────────────────────────────────────────

// GET /api/admin/liquidity
router.get("/admin/liquidity", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const wallets = await query(
      `SELECT * FROM liquidity_wallets ORDER BY coin, network`
    );
    const totals = await queryOne<{ total_usd: string }>(
      `SELECT SUM(balance_usd) as total_usd FROM liquidity_wallets`
    );
    res.json({ wallets, total_usd: parseFloat(totals?.total_usd ?? "0") });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/liquidity — upsert wallet
router.post("/admin/liquidity", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { coin, network, address, key_ref, balance, balance_usd, low_threshold, note } = req.body;
  if (!coin || !network || !address) {
    return res.status(400).json({ error: "coin, network, address required" });
  }
  try {
    const row = await queryOne(
      `INSERT INTO liquidity_wallets (coin, network, address, key_ref, balance, balance_usd, low_threshold, note, last_checked)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (coin, network) DO UPDATE SET
         address=$3, key_ref=COALESCE($4,liquidity_wallets.key_ref),
         balance=COALESCE($5,liquidity_wallets.balance),
         balance_usd=COALESCE($6,liquidity_wallets.balance_usd),
         low_threshold=COALESCE($7,liquidity_wallets.low_threshold),
         note=COALESCE($8,liquidity_wallets.note),
         last_checked=NOW()
       RETURNING *`,
      [
        coin.toUpperCase(), network.toUpperCase(), address,
        key_ref ?? null,
        balance != null ? parseFloat(balance) : null,
        balance_usd != null ? parseFloat(balance_usd) : null,
        low_threshold != null ? parseFloat(low_threshold) : 0,
        note ?? null,
      ]
    );
    res.json({ ok: true, wallet: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/liquidity/:id/balance — update balance
router.patch("/admin/liquidity/:id/balance", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(req.params.id, 10);
  const { balance, balance_usd } = req.body;
  try {
    await query(
      `UPDATE liquidity_wallets SET balance=$1, balance_usd=$2, last_checked=NOW() WHERE id=$3`,
      [parseFloat(balance ?? 0), parseFloat(balance_usd ?? 0), id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/liquidity/:id
router.delete("/admin/liquidity/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(req.params.id, 10);
  try {
    await query(`DELETE FROM liquidity_wallets WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MARKET MAKING BOT ────────────────────────────────────────────────────

// GET /api/admin/mm-bot
router.get("/admin/mm-bot", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const cfg = await queryOne(`SELECT * FROM mm_bot_config WHERE id=1`);
    res.json({ config: cfg ?? { active: false, spread_pct: 0.5, order_size_usd: 100, active_coins: [], refresh_secs: 30, total_trades: 0, total_pnl_usd: 0 } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/mm-bot — update config
router.post("/admin/mm-bot", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { spread_pct, order_size_usd, active_coins, refresh_secs, usdt_budget } = req.body;
  try {
    await query(
      `UPDATE mm_bot_config SET
         spread_pct=COALESCE($1,spread_pct),
         order_size_usd=COALESCE($2,order_size_usd),
         active_coins=COALESCE($3,active_coins),
         refresh_secs=COALESCE($4,refresh_secs),
         usdt_budget=COALESCE($5,usdt_budget),
         updated_at=NOW()
       WHERE id=1`,
      [
        spread_pct != null ? parseFloat(spread_pct) : null,
        order_size_usd != null ? parseFloat(order_size_usd) : null,
        active_coins ? active_coins : null,
        refresh_secs != null ? parseInt(refresh_secs) : null,
        usdt_budget != null ? parseFloat(usdt_budget) : null,
      ]
    );
    const cfg = await queryOne(`SELECT * FROM mm_bot_config WHERE id=1`);
    res.json({ ok: true, config: cfg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/mm-bot/toggle — start/stop
router.post("/admin/mm-bot/toggle", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const cfg = await queryOne<any>(`SELECT active FROM mm_bot_config WHERE id=1`);
    const nowActive = !cfg?.active;
    await query(`UPDATE mm_bot_config SET active=$1, updated_at=NOW() WHERE id=1`, [nowActive]);
    res.json({ ok: true, active: nowActive });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BLOCKCHAIN LISTENER / DEPOSIT SCANNER ────────────────────────────────

// GET /api/admin/blockchain/deposits — list scan log
router.get("/admin/blockchain/deposits", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { status } = req.query;
  try {
    const rows = status
      ? await query(`SELECT * FROM deposit_scan_log WHERE status=$1 ORDER BY detected_at DESC LIMIT 200`, [status])
      : await query(`SELECT * FROM deposit_scan_log ORDER BY detected_at DESC LIMIT 200`);
    res.json({ deposits: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/blockchain/scan — manually trigger a simulated scan
router.post("/admin/blockchain/scan", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const addresses = await query<any>(
      `SELECT uda.user_id, uda.coin, uda.network, uda.address
       FROM user_deposit_addresses uda
       ORDER BY uda.created_at DESC LIMIT 100`
    );
    let detected = 0;
    for (const addr of addresses) {
      const existing = await queryOne(
        `SELECT id FROM deposit_scan_log WHERE deposit_address=$1 AND status NOT IN ('credited','failed') LIMIT 1`,
        [addr.address]
      );
      if (existing) continue;
      const roll = Math.random();
      if (roll < 0.08) {
        const amount = +(Math.random() * 0.5 + 0.001).toFixed(8);
        const txHash = "0x" + Array.from({length:64}, () => Math.floor(Math.random()*16).toString(16)).join("");
        await query(
          `INSERT INTO deposit_scan_log (user_id, coin, network, deposit_address, amount, tx_hash, confirmations, required_confirmations, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'detected')`,
          [addr.user_id, addr.coin, addr.network, addr.address, amount, txHash, 0, 3]
        );
        detected++;
      }
    }
    res.json({ ok: true, scanned: addresses.length, detected });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/blockchain/deposits/:id/confirm — manually confirm & credit
router.post("/admin/blockchain/deposits/:id/confirm", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(req.params.id, 10);
  try {
    const dep = await queryOne<any>(
      `SELECT * FROM deposit_scan_log WHERE id=$1`, [id]
    );
    if (!dep) return res.status(404).json({ error: "Not found" });
    if (dep.status === "credited") return res.status(400).json({ error: "Already credited" });
    await query(
      `INSERT INTO user_balances (user_id, coin, available, locked)
       VALUES ($1,$2,$3,0)
       ON CONFLICT (user_id, coin) DO UPDATE
         SET available = user_balances.available + $3, updated_at=NOW()`,
      [dep.user_id, dep.coin, parseFloat(dep.amount)]
    );
    await query(
      `UPDATE deposit_scan_log SET status='credited', credited_at=NOW(), confirmations=required_confirmations WHERE id=$1`,
      [id]
    );
    res.json({ ok: true, credited: dep.amount, coin: dep.coin, user_id: dep.user_id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/blockchain/deposits/:id/advance — advance confirmations (simulate block progress)
router.post("/admin/blockchain/deposits/:id/advance", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(req.params.id, 10);
  try {
    const dep = await queryOne<any>(`SELECT * FROM deposit_scan_log WHERE id=$1`, [id]);
    if (!dep) return res.status(404).json({ error: "Not found" });
    const newConf = Math.min(dep.confirmations + 1, dep.required_confirmations);
    const newStatus = newConf >= dep.required_confirmations ? "confirmed" : "confirming";
    await query(
      `UPDATE deposit_scan_log SET confirmations=$1, status=$2 WHERE id=$3`,
      [newConf, newStatus, id]
    );
    res.json({ ok: true, confirmations: newConf, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
