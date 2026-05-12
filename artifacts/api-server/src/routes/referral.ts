import { Router } from "express";
import { query, queryOne } from "../lib/db";
import crypto from "crypto";

const router = Router();

function getUserId(req: any, res: any): string | null {
  const userId = (req.headers["x-user-id"] as string)?.trim();
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return userId;
}

function generateCode(userId: string): string {
  const base = userId.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${base || "USR"}${rand}`.slice(0, 10);
}

// GET /api/referral/code — get or create my referral code
router.get("/referral/code", async (req, res) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    let row = await queryOne(`SELECT * FROM referral_codes WHERE user_id = $1`, [userId]);
    if (!row) {
      let code = generateCode(userId);
      let attempts = 0;
      while (attempts < 10) {
        const existing = await queryOne(`SELECT id FROM referral_codes WHERE code = $1`, [code]);
        if (!existing) break;
        code = generateCode(userId) + crypto.randomBytes(1).toString("hex").toUpperCase();
        code = code.slice(0, 10);
        attempts++;
      }
      [row] = await query(
        `INSERT INTO referral_codes (user_id, code) VALUES ($1, $2) RETURNING *`,
        [userId, code]
      );
    }
    // Get active event
    const event = await queryOne(
      `SELECT * FROM referral_events
       WHERE is_active = true AND starts_at <= NOW()
         AND (ends_at IS NULL OR ends_at > NOW())
       ORDER BY created_at DESC LIMIT 1`
    );
    res.json({ code: row, event: event ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referral/code/customize — set a custom code
router.post("/referral/code/customize", async (req, res) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const { custom_code } = req.body;
  if (!custom_code || !/^[A-Z0-9]{4,12}$/i.test(custom_code)) {
    return res.status(400).json({ error: "Code must be 4-12 alphanumeric characters" });
  }
  const code = custom_code.toUpperCase();
  try {
    const existing = await queryOne(`SELECT user_id FROM referral_codes WHERE code = $1`, [code]);
    if (existing && existing.user_id !== userId) {
      return res.status(409).json({ error: "This code is already taken" });
    }
    const [row] = await query(
      `INSERT INTO referral_codes (user_id, code, custom_code)
       VALUES ($1, $2, $2)
       ON CONFLICT (user_id) DO UPDATE SET code = $2, custom_code = $2
       RETURNING *`,
      [userId, code]
    );
    res.json({ code: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/referral/stats — my referral stats
router.get("/referral/stats", async (req, res) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const codeRow = await queryOne(`SELECT * FROM referral_codes WHERE user_id = $1`, [userId]);
    const records = await query(
      `SELECT * FROM referral_records WHERE referrer_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    const [agg] = await query(
      `SELECT
         COUNT(*) AS total_referrals,
         COUNT(*) FILTER (WHERE status = 'rewarded') AS rewarded,
         COUNT(*) FILTER (WHERE status = 'qualified') AS qualified,
         COUNT(*) FILTER (WHERE status = 'pending') AS pending,
         COALESCE(SUM(referrer_reward), 0) AS total_earned
       FROM referral_records WHERE referrer_id = $1`,
      [userId]
    );
    res.json({ code: codeRow ?? null, stats: agg, records });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referral/apply — apply a referral code (used at registration or first trade)
router.post("/referral/apply", async (req, res) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "code required" });
  try {
    // Can't apply your own code
    const codeRow = await queryOne(`SELECT * FROM referral_codes WHERE code = $1`, [code.toUpperCase()]);
    if (!codeRow) return res.status(404).json({ error: "Invalid referral code" });
    if (codeRow.user_id === userId) return res.status(400).json({ error: "You cannot use your own referral code" });

    // Already applied a code?
    const existing = await queryOne(
      `SELECT * FROM referral_records WHERE referee_id = $1`,
      [userId]
    );
    if (existing) return res.status(409).json({ error: "You have already used a referral code" });

    // Find active event
    const event = await queryOne(
      `SELECT * FROM referral_events
       WHERE is_active = true AND starts_at <= NOW()
         AND (ends_at IS NULL OR ends_at > NOW())
       ORDER BY created_at DESC LIMIT 1`
    );

    // Check max referrals cap
    if (event && event.max_referrals_per_user > 0) {
      const [{ cnt }] = await query(
        `SELECT COUNT(*) AS cnt FROM referral_records WHERE referrer_id = $1 AND event_id = $2`,
        [codeRow.user_id, event.id]
      );
      if (parseInt(cnt) >= event.max_referrals_per_user) {
        return res.status(409).json({ error: "This referrer has reached the maximum referrals for this event" });
      }
    }

    const [record] = await query(
      `INSERT INTO referral_records
         (referrer_id, referee_id, code, event_id, referrer_reward, referee_bonus)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (referrer_id, referee_id) DO NOTHING
       RETURNING *`,
      [
        codeRow.user_id, userId, code.toUpperCase(),
        event?.id ?? null,
        event?.referrer_reward ?? 0,
        event?.referee_bonus ?? 0,
      ]
    );
    if (!record) return res.status(409).json({ error: "Referral already recorded" });

    // Increment code counter
    await query(`UPDATE referral_codes SET total_referrals = total_referrals + 1 WHERE user_id = $1`, [codeRow.user_id]);

    res.json({ ok: true, record, event: event ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/referral/events — list active public events
router.get("/referral/events", async (req, res) => {
  try {
    const events = await query(
      `SELECT id, name, description, reward_type, referrer_reward, referrer_coin,
              referee_bonus, referee_coin, kickback_rate, min_trade_volume,
              kyc_required, max_referrals_per_user, starts_at, ends_at, is_active
       FROM referral_events
       WHERE is_active = true AND starts_at <= NOW()
         AND (ends_at IS NULL OR ends_at > NOW())
       ORDER BY created_at DESC`
    );
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/referral/check/:code — check if a code exists (public, for signup)
router.get("/referral/check/:code", async (req, res) => {
  const code = req.params.code.toUpperCase();
  try {
    const row = await queryOne(
      `SELECT rc.code, rc.total_referrals
       FROM referral_codes rc WHERE rc.code = $1`,
      [code]
    );
    if (!row) return res.status(404).json({ valid: false });
    res.json({ valid: true, code: row.code });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
