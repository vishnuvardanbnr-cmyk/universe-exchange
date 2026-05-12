import { Router } from "express";
import { query, queryOne } from "../lib/db";
import { logger } from "../lib/logger";

const ADMIN_KEY = process.env["ADMIN_SECRET"] ?? "cryptox-admin-2024";

function isAdmin(req: any): boolean {
  return req.headers["x-admin-key"] === ADMIN_KEY;
}

const router = Router();

// ─── User: Get notifications (filtered to active, non-dismissed, with read state) ─
router.get("/notifications", async (req, res) => {
  const userId = (req.headers["x-user-id"] as string) || "";
  try {
    let rows: any[];
    if (userId) {
      rows = await query(
        `SELECT n.id, n.title, n.body, n.type, n.icon, n.created_at,
                (nr.user_id IS NOT NULL) as read
         FROM notifications n
         LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $1
         LEFT JOIN notification_dismissals nd ON nd.notification_id = n.id AND nd.user_id = $1
         WHERE n.is_active = true AND nd.notification_id IS NULL
         ORDER BY n.created_at DESC
         LIMIT 100`,
        [userId]
      );
    } else {
      rows = await query(
        `SELECT id, title, body, type, icon, created_at, false as read
         FROM notifications
         WHERE is_active = true
         ORDER BY created_at DESC
         LIMIT 100`
      );
    }
    res.json({ notifications: rows });
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch notifications");
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// ─── User: Mark single notification as read ───────────────────────────────────
router.post("/notifications/:id/read", async (req, res) => {
  const userId = (req.headers["x-user-id"] as string) || "";
  const { id } = req.params;
  if (!userId) return res.status(400).json({ error: "x-user-id required" });
  try {
    await query(
      `INSERT INTO notification_reads (notification_id, user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [parseInt(id), userId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "Failed to mark notification read");
    res.status(500).json({ error: "Failed" });
  }
});

// ─── User: Mark all notifications as read ────────────────────────────────────
router.post("/notifications/read-all", async (req, res) => {
  const userId = (req.headers["x-user-id"] as string) || "";
  if (!userId) return res.status(400).json({ error: "x-user-id required" });
  try {
    await query(
      `INSERT INTO notification_reads (notification_id, user_id)
       SELECT n.id, $1 FROM notifications n
       WHERE n.is_active = true
       ON CONFLICT DO NOTHING`,
      [userId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "Failed to mark all read");
    res.status(500).json({ error: "Failed" });
  }
});

// ─── User: Dismiss a notification ────────────────────────────────────────────
router.delete("/notifications/:id", async (req, res) => {
  const userId = (req.headers["x-user-id"] as string) || "";
  const { id } = req.params;
  if (!userId) return res.status(400).json({ error: "x-user-id required" });
  try {
    await query(
      `INSERT INTO notification_dismissals (notification_id, user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [parseInt(id), userId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "Failed to dismiss notification");
    res.status(500).json({ error: "Failed" });
  }
});

// ─── User: Clear all (dismiss all active notifications) ───────────────────────
router.delete("/notifications", async (req, res) => {
  const userId = (req.headers["x-user-id"] as string) || "";
  if (!userId) return res.status(400).json({ error: "x-user-id required" });
  try {
    await query(
      `INSERT INTO notification_dismissals (notification_id, user_id)
       SELECT n.id, $1 FROM notifications n
       WHERE n.is_active = true
       ON CONFLICT DO NOTHING`,
      [userId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "Failed to clear notifications");
    res.status(500).json({ error: "Failed" });
  }
});

// ─── Admin: List all notifications ───────────────────────────────────────────
router.get("/admin/notifications", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const rows = await query(
      `SELECT id, title, body, type, icon, is_active, created_at FROM notifications ORDER BY created_at DESC`
    );
    res.json({ notifications: rows });
  } catch (err: any) {
    logger.error({ err }, "Admin: Failed to fetch notifications");
    res.status(500).json({ error: "Failed" });
  }
});

// ─── Admin: Create a notification ─────────────────────────────────────────────
router.post("/admin/notifications", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { title, body, type = "system", icon } = req.body;
  if (!title || !body) return res.status(400).json({ error: "title and body are required" });
  const validTypes = ["trade", "price", "staking", "system", "security", "promo"];
  if (!validTypes.includes(type)) return res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
  try {
    const [row] = await query(
      `INSERT INTO notifications (title, body, type, icon) VALUES ($1, $2, $3, $4) RETURNING *`,
      [String(title).slice(0, 255), String(body).slice(0, 2000), type, icon ?? null]
    );
    logger.info({ id: row.id, type: row.type }, "Admin created notification");
    res.status(201).json({ notification: row });
  } catch (err: any) {
    logger.error({ err }, "Admin: Failed to create notification");
    res.status(500).json({ error: "Failed to create notification" });
  }
});

// ─── Admin: Update notification (toggle active / edit) ────────────────────────
router.patch("/admin/notifications/:id", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { id } = req.params;
  const { title, body, type, icon, is_active } = req.body;
  try {
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (title !== undefined) { sets.push(`title = $${i++}`); params.push(String(title).slice(0, 255)); }
    if (body !== undefined) { sets.push(`body = $${i++}`); params.push(String(body).slice(0, 2000)); }
    if (type !== undefined) { sets.push(`type = $${i++}`); params.push(type); }
    if (icon !== undefined) { sets.push(`icon = $${i++}`); params.push(icon); }
    if (is_active !== undefined) { sets.push(`is_active = $${i++}`); params.push(Boolean(is_active)); }
    if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });
    params.push(parseInt(id));
    const [row] = await query(
      `UPDATE notifications SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ notification: row });
  } catch (err: any) {
    logger.error({ err }, "Admin: Failed to update notification");
    res.status(500).json({ error: "Failed" });
  }
});

// ─── Admin: Delete a notification permanently ──────────────────────────────────
router.delete("/admin/notifications/:id", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { id } = req.params;
  try {
    await query(`DELETE FROM notifications WHERE id = $1`, [parseInt(id)]);
    logger.info({ id }, "Admin deleted notification");
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "Admin: Failed to delete notification");
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
