import { Router } from "express";
import { query, queryOne } from "../lib/db";
import { randomUUID } from "crypto";
import { COIN_NETWORKS, generateDepositAddress } from "../lib/depositNetworks";

const router = Router();

function requireUser(req: any, res: any): string | null {
  const userId = req.headers["x-user-id"] as string;
  if (!userId || userId.trim() === "") {
    res.status(401).json({ error: "Unauthorized: x-user-id header required" });
    return null;
  }
  return userId.trim();
}

// GET /api/wallet/tradable-coins — public: returns only enabled coins
router.get("/wallet/tradable-coins", async (req, res) => {
  try {
    const rows = await query(`SELECT coin FROM tradable_coins WHERE enabled = true ORDER BY coin`);
    res.json({ coins: rows.map((r) => r.coin) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/wallet/balances
router.get("/wallet/balances", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const rows = await query(
      `SELECT coin, CAST(available AS FLOAT) as available, CAST(locked AS FLOAT) as locked, updated_at
       FROM user_balances WHERE user_id = $1 AND (available > 0 OR locked > 0)
       ORDER BY available DESC`,
      [userId]
    );
    res.json({ balances: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/wallet/deposit-networks/:coin — list supported networks for a coin
router.get("/wallet/deposit-networks/:coin", (req, res) => {
  const coin = req.params.coin.toUpperCase();
  const networks = COIN_NETWORKS[coin];
  if (!networks || networks.length === 0) {
    return res.json({ networks: [] });
  }
  res.json({
    networks: networks.map((n) => ({
      coin,
      network: n.network,
      label: n.label,
      memoRequired: n.memoRequired ?? false,
    })),
  });
});

// GET /api/wallet/deposit-address/:coin?network=...
// Returns (or creates) the user's unique deposit address for this coin/network
router.get("/wallet/deposit-address/:coin", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const coin = req.params.coin.toUpperCase();
  const network = ((req.query.network as string) ?? "").toUpperCase();

  if (!network) return res.status(400).json({ error: "network query param required" });

  try {
    // Look up existing address
    let row = await queryOne<any>(
      `SELECT user_id, coin, network, address, memo FROM user_deposit_addresses
       WHERE user_id=$1 AND coin=$2 AND network=$3`,
      [userId, coin, network]
    );

    if (!row) {
      // Generate a deterministic unique address for this user+coin+network
      const { address, memo } = generateDepositAddress(userId, coin, network);
      await query(
        `INSERT INTO user_deposit_addresses (user_id, coin, network, address, memo)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, coin, network) DO NOTHING`,
        [userId, coin, network, address, memo ?? null]
      );
      row = await queryOne<any>(
        `SELECT user_id, coin, network, address, memo FROM user_deposit_addresses
         WHERE user_id=$1 AND coin=$2 AND network=$3`,
        [userId, coin, network]
      );
    }

    if (!row) return res.status(500).json({ error: "Failed to generate address" });

    const cfg = COIN_NETWORKS[coin]?.find((n) => n.network === network);
    res.json({
      coin,
      network,
      label: cfg?.label ?? network,
      address: row.address,
      memo: row.memo ?? undefined,
      memoRequired: cfg?.memoRequired ?? false,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/wallet/deposit-request — user marks they've sent a deposit
router.post("/wallet/deposit-request", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const { coin, network, amount, txHash, note } = req.body;
  if (!coin || !network) return res.status(400).json({ error: "coin and network required" });
  try {
    const id = randomUUID();
    await query(
      `INSERT INTO deposit_requests (id, user_id, coin, network, amount, tx_hash, status, note)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7)`,
      [id, userId, coin.toUpperCase(), network.toUpperCase(), amount ?? null, txHash ?? null, note ?? null]
    );
    res.json({ id, status: "pending" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/wallet/check-deposits — user triggers a scan for their own pending deposits
// Simulates blockchain scan for this user+coin, auto-credits confirmed ones, returns summary
router.post("/wallet/check-deposits", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const { coin } = req.body;

  try {
    // Fetch this user's deposit addresses (optionally filtered by coin)
    const addresses = coin
      ? await query<any>(
          `SELECT user_id, coin, network, address FROM user_deposit_addresses WHERE user_id=$1 AND coin=$2`,
          [userId, coin.toUpperCase()]
        )
      : await query<any>(
          `SELECT user_id, coin, network, address FROM user_deposit_addresses WHERE user_id=$1`,
          [userId]
        );

    let newlyDetected = 0;
    let credited = 0;

    for (const addr of addresses) {
      // Check if there's already a pending entry for this address
      const existing = await queryOne<any>(
        `SELECT id, status, confirmations, required_confirmations, amount FROM deposit_scan_log
         WHERE deposit_address=$1 AND status NOT IN ('credited','failed') LIMIT 1`,
        [addr.address]
      );

      if (existing) {
        // Advance confirmations toward required
        const newConf = Math.min(existing.confirmations + 2, existing.required_confirmations);
        const newStatus = newConf >= existing.required_confirmations ? "confirmed" : "confirming";
        await query(
          `UPDATE deposit_scan_log SET confirmations=$1, status=$2 WHERE id=$3`,
          [newConf, newStatus, existing.id]
        );
        // If now confirmed, auto-credit
        if (newStatus === "confirmed") {
          await query(
            `INSERT INTO user_balances (user_id, coin, available, locked)
             VALUES ($1,$2,$3,0)
             ON CONFLICT (user_id, coin) DO UPDATE
               SET available = user_balances.available + $3, updated_at=NOW()`,
            [addr.user_id, addr.coin, parseFloat(existing.amount)]
          );
          await query(
            `UPDATE deposit_scan_log SET status='credited', credited_at=NOW() WHERE id=$1`,
            [existing.id]
          );
          credited++;
        }
      } else {
        // Simulate: ~30% chance a new deposit is detected when user manually checks
        if (Math.random() < 0.30) {
          const amount = +(Math.random() * 0.5 + 0.001).toFixed(8);
          const txHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
          await query(
            `INSERT INTO deposit_scan_log (user_id, coin, network, deposit_address, amount, tx_hash, confirmations, required_confirmations, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'confirming')`,
            [addr.user_id, addr.coin, addr.network, addr.address, amount, txHash, 2, 3]
          );
          newlyDetected++;
        }
      }
    }

    res.json({ ok: true, found: newlyDetected, credited, scanned: addresses.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/wallet/withdraw
router.post("/wallet/withdraw", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const { coin, network, amount, toAddress, memo } = req.body;
  if (!coin || !amount || !toAddress) {
    return res.status(400).json({ error: "coin, amount, toAddress required" });
  }
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "Invalid amount" });

  try {
    const bal = await queryOne<any>(
      `SELECT CAST(available AS FLOAT) as available FROM user_balances WHERE user_id=$1 AND coin=$2`,
      [userId, coin.toUpperCase()]
    );
    if (!bal || (bal as any).available < amt) {
      return res.status(400).json({ error: "Insufficient balance" });
    }
    const id = randomUUID();
    await query(
      `UPDATE user_balances SET available = available - $1, locked = locked + $1, updated_at = NOW()
       WHERE user_id=$2 AND coin=$3`,
      [amt, userId, coin.toUpperCase()]
    );
    await query(
      `INSERT INTO withdrawal_requests (id, user_id, coin, network, amount, to_address, memo, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')`,
      [id, userId, coin.toUpperCase(), (network ?? "").toUpperCase(), amt, toAddress, memo ?? null]
    );
    res.json({ id, status: "pending" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/wallet/transactions — paginated deposit & withdrawal history
// Query params: page (1-based, default 1), limit (default 20, max 50), source (all|deposit|withdraw)
router.get("/wallet/transactions", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const offset = (page - 1) * pageSize;
    const source = (req.query.source as string) ?? "all";

    // Build the UNION subqueries based on the source filter
    const parts: string[] = [];
    const params: any[] = [userId];

    if (source === "all" || source === "deposit") {
      parts.push(
        `SELECT CAST(id AS TEXT) AS id, 'deposit_request' AS source, coin,
                COALESCE(network, '') AS network,
                CAST(amount AS FLOAT) AS amount,
                COALESCE(tx_hash, '') AS tx_hash,
                COALESCE(to_address, '') AS to_address,
                status, created_at,
                COALESCE(note, '') AS note
         FROM deposit_requests WHERE user_id=$1`
      );
    }
    if (source === "all" || source === "withdraw") {
      parts.push(
        `SELECT CAST(id AS TEXT) AS id, 'withdrawal' AS source, coin,
                COALESCE(network, '') AS network,
                CAST(amount AS FLOAT) AS amount,
                COALESCE(tx_hash, '') AS tx_hash,
                COALESCE(to_address, '') AS to_address,
                status, created_at,
                COALESCE(note, '') AS note
         FROM withdrawal_requests WHERE user_id=$1`
      );
    }
    if (source === "all" || source === "deposit") {
      parts.push(
        `SELECT CAST(id AS TEXT) AS id, 'on_chain' AS source, coin,
                COALESCE(network, '') AS network,
                CAST(amount AS FLOAT) AS amount,
                COALESCE(tx_hash, '') AS tx_hash,
                '' AS to_address,
                status, detected_at AS created_at,
                '' AS note
         FROM deposit_scan_log WHERE user_id=$1`
      );
    }

    if (parts.length === 0) {
      return res.json({ transactions: [], total: 0, page, pageSize, hasMore: false });
    }

    // Count total for this user+filter
    const countSql = `SELECT COUNT(*) AS cnt FROM (${parts.join(" UNION ALL ")}) t`;
    const countRow = await queryOne<{ cnt: string }>(countSql, params);
    const total = parseInt(countRow?.cnt ?? "0", 10);

    // Fetch one page
    const dataSql = `
      SELECT * FROM (${parts.join(" UNION ALL ")}) t
      ORDER BY created_at DESC
      LIMIT ${pageSize + 1} OFFSET ${offset}
    `;
    const rows = await query<any>(dataSql, params);

    // Use the extra row to determine hasMore, then slice it off
    const hasMore = rows.length > pageSize;
    const transactions = hasMore ? rows.slice(0, pageSize) : rows;

    res.json({ transactions, total, page, pageSize, hasMore });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
