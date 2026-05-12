import { Router } from "express";
import { query, queryOne } from "../lib/db";
import { logger } from "../lib/logger";

const ADMIN_KEY = process.env["ADMIN_SECRET"] ?? "cryptox-admin-2024";
function isAdmin(req: any): boolean {
  return req.headers["x-admin-key"] === ADMIN_KEY;
}

const router = Router();

// GET /api/kyc/status — get user's KYC levels
router.get("/kyc/status", async (req, res) => {
  const userId = String(req.headers["x-user-id"] ?? req.query["userId"] ?? "");
  if (!userId) return res.status(400).json({ error: "x-user-id header required" });

  const rows = await query(
    `SELECT id, level, status, rejection_reason, created_at, updated_at,
            first_name, last_name, date_of_birth, nationality, country, document_type
     FROM kyc_submissions WHERE user_id = $1 ORDER BY level, created_at DESC`,
    [userId],
  );

  const byLevel: Record<number, any> = {};
  for (const row of rows) {
    if (!byLevel[row.level]) byLevel[row.level] = row;
  }

  res.json({
    level1: byLevel[1] ?? null,
    level2: byLevel[2] ?? null,
    verifiedLevel: (() => {
      if (byLevel[2]?.status === "approved") return 2;
      if (byLevel[1]?.status === "approved") return 1;
      return 0;
    })(),
  });
});

// POST /api/kyc/submit — submit or resubmit KYC
router.post("/kyc/submit", async (req, res) => {
  const {
    userId, level,
    firstName, lastName, dateOfBirth, nationality, country, address,
    documentType, documentFront, documentBack, selfie,
  } = req.body;

  if (!userId || !level) return res.status(400).json({ error: "userId and level required" });
  if (level < 1 || level > 2) return res.status(400).json({ error: "level must be 1 or 2" });

  if (level === 1) {
    if (!firstName || !lastName || !dateOfBirth || !nationality || !country)
      return res.status(400).json({ error: "Personal info required for level 1" });
  }
  if (level === 2) {
    if (!documentType || !documentFront || !selfie)
      return res.status(400).json({ error: "Document type, front image, and selfie required for level 2" });

    const l1 = await queryOne(
      `SELECT id FROM kyc_submissions WHERE user_id = $1 AND level = 1 AND status = 'approved'`,
      [userId],
    );
    if (!l1) return res.status(400).json({ error: "Level 1 verification must be approved before Level 2" });
  }

  const existing = await queryOne(
    `SELECT id, status FROM kyc_submissions WHERE user_id = $1 AND level = $2 ORDER BY created_at DESC LIMIT 1`,
    [userId, level],
  );

  if (existing && ["pending", "under_review"].includes(existing.status)) {
    return res.status(409).json({ error: "A verification request is already in review" });
  }

  const validateB64 = (s: string | undefined, maxMb = 5) =>
    !s || s.length <= maxMb * 1.37 * 1024 * 1024;

  if (!validateB64(documentFront) || !validateB64(documentBack) || !validateB64(selfie)) {
    return res.status(400).json({ error: "Image too large (max 5 MB each)" });
  }

  if (existing && existing.status === "rejected") {
    await query(
      `UPDATE kyc_submissions SET
        status = 'pending', first_name=$3, last_name=$4, date_of_birth=$5,
        nationality=$6, country=$7, address=$8, document_type=$9,
        document_front=$10, document_back=$11, selfie=$12,
        rejection_reason=NULL, reviewed_by=NULL, reviewed_at=NULL,
        updated_at=NOW()
       WHERE id = $1 AND user_id = $2`,
      [existing.id, userId, firstName, lastName, dateOfBirth, nationality, country, address,
       documentType, documentFront ?? null, documentBack ?? null, selfie ?? null],
    );
    const updated = await queryOne(`SELECT * FROM kyc_submissions WHERE id = $1`, [existing.id]);
    logger.info({ userId, level }, "KYC resubmitted");
    return res.status(200).json({ submission: updated });
  }

  const inserted = await queryOne(
    `INSERT INTO kyc_submissions
       (user_id, level, status, first_name, last_name, date_of_birth,
        nationality, country, address, document_type, document_front, document_back, selfie)
     VALUES ($1,$2,'pending',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id, user_id, level, status, first_name, last_name, date_of_birth,
               nationality, country, document_type, created_at`,
    [userId, level, firstName, lastName, dateOfBirth, nationality, country, address,
     documentType ?? null, documentFront ?? null, documentBack ?? null, selfie ?? null],
  );

  logger.info({ userId, level }, "KYC submitted");
  res.status(201).json({ submission: inserted });
});

// Admin: GET /api/admin/kyc — list submissions (filter by status)
router.get("/admin/kyc", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { status, level } = req.query;
  let sql = `SELECT id, user_id, level, status, first_name, last_name, date_of_birth,
                    nationality, country, document_type, rejection_reason, created_at, updated_at
             FROM kyc_submissions WHERE 1=1`;
  const params: any[] = [];
  if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
  if (level) { params.push(Number(level)); sql += ` AND level = $${params.length}`; }
  sql += ` ORDER BY created_at DESC LIMIT 100`;
  const rows = await query(sql, params);
  res.json({ submissions: rows });
});

// Admin: GET /api/admin/kyc/:id — get full submission including images
router.get("/admin/kyc/:id", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const row = await queryOne(`SELECT * FROM kyc_submissions WHERE id = $1`, [req.params["id"]]);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ submission: row });
});

// Admin: POST /api/admin/kyc/:id/approve
router.post("/admin/kyc/:id/approve", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const row = await queryOne(`SELECT * FROM kyc_submissions WHERE id = $1`, [req.params["id"]]);
  if (!row) return res.status(404).json({ error: "Not found" });
  if (!["pending", "under_review"].includes(row.status)) {
    return res.status(400).json({ error: "Can only approve pending/under_review submissions" });
  }
  await query(
    `UPDATE kyc_submissions SET status='approved', reviewed_at=NOW(), updated_at=NOW() WHERE id=$1`,
    [req.params["id"]],
  );
  logger.info({ id: req.params["id"], userId: row.user_id }, "KYC approved");
  res.json({ ok: true });
});

// Admin: POST /api/admin/kyc/:id/reject
router.post("/admin/kyc/:id/reject", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { reason } = req.body;
  const row = await queryOne(`SELECT * FROM kyc_submissions WHERE id = $1`, [req.params["id"]]);
  if (!row) return res.status(404).json({ error: "Not found" });
  await query(
    `UPDATE kyc_submissions SET status='rejected', rejection_reason=$2, reviewed_at=NOW(), updated_at=NOW() WHERE id=$1`,
    [req.params["id"], reason ?? "Does not meet verification requirements"],
  );
  logger.info({ id: req.params["id"], userId: row.user_id, reason }, "KYC rejected");
  res.json({ ok: true });
});

// Admin: POST /api/admin/kyc/:id/under-review
router.post("/admin/kyc/:id/under-review", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  await query(
    `UPDATE kyc_submissions SET status='under_review', updated_at=NOW() WHERE id=$1`,
    [req.params["id"]],
  );
  res.json({ ok: true });
});

export default router;
