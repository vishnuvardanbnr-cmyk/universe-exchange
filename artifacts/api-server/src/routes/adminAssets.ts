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

// GET /api/admin/assets
router.get("/admin/assets", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await query(
      `SELECT * FROM custom_assets ORDER BY created_at DESC`
    );
    res.json({ assets: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/assets — create new asset
router.post("/admin/assets", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const {
    symbol, name, chain, contract_address, decimals,
    logo_url, key_ref, min_deposit, min_withdrawal,
    withdrawal_fee, enabled, listed,
  } = req.body;
  if (!symbol || !name) return res.status(400).json({ error: "symbol and name required" });
  try {
    const row = await queryOne(
      `INSERT INTO custom_assets
         (symbol, name, chain, contract_address, decimals, logo_url, key_ref,
          min_deposit, min_withdrawal, withdrawal_fee, enabled, listed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        symbol.toUpperCase(), name,
        chain ?? "EVM",
        contract_address ?? null,
        decimals ?? 18,
        logo_url ?? null,
        key_ref ?? null,
        parseFloat(min_deposit ?? 0),
        parseFloat(min_withdrawal ?? 0),
        parseFloat(withdrawal_fee ?? 0),
        enabled !== false,
        listed !== false,
      ]
    );
    res.json({ ok: true, asset: row });
  } catch (err: any) {
    if (err.message.includes("unique")) return res.status(409).json({ error: `Symbol ${symbol} already exists` });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/assets/:id — update asset
router.put("/admin/assets/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const {
    name, chain, contract_address, decimals, logo_url, key_ref,
    min_deposit, min_withdrawal, withdrawal_fee, enabled, listed,
  } = req.body;
  try {
    const row = await queryOne(
      `UPDATE custom_assets SET
         name=COALESCE($1,name),
         chain=COALESCE($2,chain),
         contract_address=COALESCE($3,contract_address),
         decimals=COALESCE($4,decimals),
         logo_url=COALESCE($5,logo_url),
         key_ref=COALESCE($6,key_ref),
         min_deposit=COALESCE($7,min_deposit),
         min_withdrawal=COALESCE($8,min_withdrawal),
         withdrawal_fee=COALESCE($9,withdrawal_fee),
         enabled=COALESCE($10,enabled),
         listed=COALESCE($11,listed),
         updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [
        name ?? null, chain ?? null, contract_address ?? null,
        decimals ?? null, logo_url ?? null, key_ref ?? null,
        min_deposit != null ? parseFloat(min_deposit) : null,
        min_withdrawal != null ? parseFloat(min_withdrawal) : null,
        withdrawal_fee != null ? parseFloat(withdrawal_fee) : null,
        enabled != null ? Boolean(enabled) : null,
        listed != null ? Boolean(listed) : null,
        id,
      ]
    );
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true, asset: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/assets/:id
router.delete("/admin/assets/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await query(`DELETE FROM custom_assets WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/assets/:id/toggle — quick enable/disable
router.patch("/admin/assets/:id/toggle", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { field } = req.body; // 'enabled' or 'listed'
  const col = field === "listed" ? "listed" : "enabled";
  try {
    const row = await queryOne(
      `UPDATE custom_assets SET ${col} = NOT ${col}, updated_at=NOW()
       WHERE id=$1 RETURNING id, symbol, enabled, listed`,
      [id]
    );
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true, ...row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
