import { Router } from "express";
import crypto from "crypto";
import { query, queryOne } from "../lib/db";
import { logger } from "../lib/logger";

const router = Router();

const ADMIN_KEY = process.env["ADMIN_KEY"] ?? "cryptox-admin-2024";

// ---------- Google OAuth (server-side authorization code flow) ----------
const GOOGLE_CLIENT_ID = process.env["EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"] ?? "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] ?? "";
const APP_DOMAIN = process.env["REPLIT_DEV_DOMAIN"] ?? "";
const GOOGLE_REDIRECT_URI = APP_DOMAIN ? `https://${APP_DOMAIN}/api/auth/google/callback` : "";

type StateEntry = { returnUrl: string; createdAt: number };
const stateStore = new Map<string, StateEntry>();
const STATE_TTL_MS = 10 * 60 * 1000;

function cleanupStates() {
  const now = Date.now();
  for (const [k, v] of stateStore) {
    if (now - v.createdAt > STATE_TTL_MS) stateStore.delete(k);
  }
}

function isAllowedReturnUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return u.hostname.endsWith(".replit.dev") || u.hostname === "localhost";
  } catch {
    return false;
  }
}

// Returns the public IP of the requesting client (best-effort; honors x-forwarded-for behind proxies)
router.get("/auth/client-ip", (req, res) => {
  const fwd = (req.headers["x-forwarded-for"] as string | undefined) ?? "";
  const ip = (fwd.split(",")[0] || req.ip || req.socket.remoteAddress || "").trim();
  // Strip IPv6-mapped IPv4 prefix
  const clean = ip.replace(/^::ffff:/, "") || "unknown";
  res.json({ ip: clean, userAgent: req.headers["user-agent"] ?? "" });
});

router.get("/auth/google/start", (req, res) => {
  cleanupStates();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !APP_DOMAIN) {
    return res.status(500).send("Google OAuth not configured on server");
  }
  const returnUrl = String(req.query["return"] ?? "");
  if (!isAllowedReturnUrl(returnUrl)) {
    return res.status(400).send("Invalid return URL");
  }
  const state = crypto.randomBytes(16).toString("hex");
  stateStore.set(state, { returnUrl, createdAt: Date.now() });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
    include_granted_scopes: "true",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/auth/google/callback", async (req, res) => {
  cleanupStates();
  const code = typeof req.query["code"] === "string" ? req.query["code"] : "";
  const state = typeof req.query["state"] === "string" ? req.query["state"] : "";
  const errorParam = typeof req.query["error"] === "string" ? req.query["error"] : "";

  const stored = state ? stateStore.get(state) : undefined;
  if (state) stateStore.delete(state);
  if (!stored) return res.status(400).send("Invalid or expired OAuth state");

  const fail = (msg: string) =>
    res.redirect(`${stored.returnUrl}#google_error=${encodeURIComponent(msg)}`);

  if (errorParam) return fail(errorParam);
  if (!code) return fail("missing_code");
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return fail("not_configured");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      logger.error({ status: tokenRes.status, body }, "Google token exchange failed");
      return fail(`token_exchange_${tokenRes.status}`);
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) return fail("no_access_token");

    const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) return fail("profile_fetch_failed");
    const profile = (await profileRes.json()) as { sub: string; email?: string; name?: string };
    if (!profile.sub) return fail("no_sub");

    const payload = Buffer.from(
      JSON.stringify({ sub: profile.sub, email: profile.email ?? "", name: profile.name ?? "" })
    ).toString("base64url");
    res.redirect(`${stored.returnUrl}#google_profile=${payload}`);
  } catch (err: any) {
    logger.error({ err }, "Google callback exception");
    fail(err?.message ?? "unknown_error");
  }
});

function requireAdmin(req: any, res: any): boolean {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

// GET /api/auth/check-admin — check if a user is admin (uses x-user-id header)
router.get("/auth/check-admin", async (req, res) => {
  const userId = (req.headers["x-user-id"] as string)?.trim();
  if (!userId) return res.status(400).json({ isAdmin: false });
  try {
    const row = await queryOne(`SELECT user_id FROM admin_users WHERE user_id = $1`, [userId]);
    res.json({ isAdmin: !!row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users/:userId/grant-admin — grant admin (X-Admin-Key protected)
router.post("/admin/users/:userId/grant-admin", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { userId } = req.params;
  try {
    await query(
      `INSERT INTO admin_users (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [userId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:userId/grant-admin — revoke admin (X-Admin-Key protected)
router.delete("/admin/users/:userId/grant-admin", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { userId } = req.params;
  try {
    await query(`DELETE FROM admin_users WHERE user_id = $1`, [userId]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users/admins — list all admin users (X-Admin-Key protected)
router.get("/admin/users/admins", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await query(`SELECT user_id, granted_at FROM admin_users ORDER BY granted_at DESC`);
    res.json({ admins: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
