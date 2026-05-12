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

// GET /api/admin/referral/events
router.get("/admin/referral/events", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const events = await query(`
      SELECT e.*,
        (SELECT COUNT(*) FROM referral_records r WHERE r.event_id = e.id) AS total_participants,
        (SELECT COUNT(*) FROM referral_records r WHERE r.event_id = e.id AND r.status = 'rewarded') AS rewarded_count
      FROM referral_events e
      ORDER BY e.created_at DESC
    `);
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/referral/events
router.post("/admin/referral/events", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const {
    name, description, reward_type, referrer_reward, referrer_coin,
    referee_bonus, referee_coin, kickback_rate,
    min_trade_volume, kyc_required, max_referrals_per_user,
    total_budget, starts_at, ends_at, is_active,
  } = req.body;
  if (!name || !reward_type) return res.status(400).json({ error: "name and reward_type required" });
  try {
    const [row] = await query(
      `INSERT INTO referral_events
        (name, description, reward_type, referrer_reward, referrer_coin,
         referee_bonus, referee_coin, kickback_rate,
         min_trade_volume, kyc_required, max_referrals_per_user,
         total_budget, starts_at, ends_at, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        name, description ?? null, reward_type,
        referrer_reward ?? 10, referrer_coin ?? "USDT",
        referee_bonus ?? 0, referee_coin ?? "USDT",
        kickback_rate ?? 0,
        min_trade_volume ?? 0, kyc_required ?? false,
        max_referrals_per_user ?? 0, total_budget ?? 0,
        starts_at ?? new Date(), ends_at ?? null,
        is_active ?? true,
      ]
    );
    res.json({ event: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/referral/events/:id
router.put("/admin/referral/events/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;
  const fields = req.body;
  const allowed = [
    "name","description","reward_type","referrer_reward","referrer_coin",
    "referee_bonus","referee_coin","kickback_rate","min_trade_volume",
    "kyc_required","max_referrals_per_user","total_budget","starts_at","ends_at","is_active",
  ];
  const sets: string[] = [];
  const values: any[] = [];
  let i = 1;
  for (const key of allowed) {
    if (key in fields) {
      sets.push(`${key} = $${i}`);
      values.push(fields[key]);
      i++;
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: "No valid fields to update" });
  sets.push(`updated_at = NOW()`);
  values.push(id);
  try {
    const [row] = await query(
      `UPDATE referral_events SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!row) return res.status(404).json({ error: "Event not found" });
    res.json({ event: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/referral/events/:id
router.delete("/admin/referral/events/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;
  try {
    await query(`DELETE FROM referral_events WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/referral/stats — overall referral stats
router.get("/admin/referral/stats", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [totals] = await query(`
      SELECT
        COUNT(*) AS total_records,
        COUNT(*) FILTER (WHERE status = 'rewarded') AS rewarded,
        COUNT(*) FILTER (WHERE status = 'qualified') AS qualified,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COALESCE(SUM(referrer_reward), 0) AS total_referrer_paid,
        COALESCE(SUM(referee_bonus), 0) AS total_referee_paid
      FROM referral_records
    `);
    const [codes] = await query(`SELECT COUNT(*) AS total_codes FROM referral_codes`);
    const [events] = await query(`SELECT COUNT(*) AS total_events, COUNT(*) FILTER (WHERE is_active) AS active_events FROM referral_events`);
    res.json({ stats: { ...totals, ...codes, ...events } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/referral/records — all referral records with pagination
router.get("/admin/referral/records", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string;
  try {
    const where = status ? `WHERE r.status = $3` : "";
    const params: any[] = status ? [limit, offset, status] : [limit, offset];
    const records = await query(
      `SELECT r.*, rc.code AS ref_code
       FROM referral_records r
       LEFT JOIN referral_codes rc ON rc.user_id = r.referrer_id
       ${where}
       ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`,
      params
    );
    const [{ cnt }] = await query(
      `SELECT COUNT(*) AS cnt FROM referral_records ${status ? "WHERE status = $1" : ""}`,
      status ? [status] : []
    );
    res.json({ records, total: parseInt(cnt), page, limit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/referral/records/:id/reward — manually mark as rewarded
router.post("/admin/referral/records/:id/reward", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;
  try {
    const record = await queryOne(`SELECT * FROM referral_records WHERE id = $1`, [id]);
    if (!record) return res.status(404).json({ error: "Record not found" });
    await query(
      `UPDATE referral_records SET status = 'rewarded', rewarded_at = NOW() WHERE id = $1`,
      [id]
    );
    await query(
      `UPDATE referral_codes SET
         total_earned = total_earned + $1,
         qualified_referrals = qualified_referrals + 1
       WHERE user_id = $2`,
      [record.referrer_reward, record.referrer_id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
