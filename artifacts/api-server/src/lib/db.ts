import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

const ALL_SUPPORTED_COINS = [
  "BTC","ETH","BNB","SOL","XRP","ADA","DOGE","AVAX","TRX","DOT",
  "MATIC","LINK","LTC","ATOM","UNI","NEAR","ARB","OP","APT","SUI",
  "INJ","USDT","USDC",
];

export async function initP2P() {
  await query(`
    CREATE TABLE IF NOT EXISTS p2p_ads (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      type VARCHAR(10) NOT NULL CHECK (type IN ('buy','sell')),
      coin VARCHAR(20) NOT NULL,
      fiat_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      price DECIMAL(20,8) NOT NULL,
      min_amount DECIMAL(20,8) NOT NULL,
      max_amount DECIMAL(20,8) NOT NULL,
      available_amount DECIMAL(20,8) NOT NULL DEFAULT 0,
      payment_methods TEXT[] NOT NULL DEFAULT '{}',
      terms TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','paused','deleted','admin_paused')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS p2p_orders (
      id SERIAL PRIMARY KEY,
      ad_id INTEGER REFERENCES p2p_ads(id),
      buyer_id VARCHAR(255) NOT NULL,
      seller_id VARCHAR(255) NOT NULL,
      coin VARCHAR(20) NOT NULL,
      crypto_amount DECIMAL(20,8) NOT NULL,
      fiat_amount DECIMAL(20,8) NOT NULL,
      price DECIMAL(20,8) NOT NULL,
      payment_method VARCHAR(100) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','paid','released','cancelled','disputed','resolved')),
      dispute_reason TEXT,
      admin_note TEXT,
      payment_proof TEXT,
      payment_window_minutes INTEGER NOT NULL DEFAULT 15,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS payment_proof TEXT`);
  await query(`ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS payment_window_minutes INTEGER NOT NULL DEFAULT 15`);
  await query(`ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`);
  await query(`
    CREATE TABLE IF NOT EXISTS p2p_messages (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES p2p_orders(id),
      sender_id VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS p2p_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      enabled_coins TEXT[] NOT NULL DEFAULT ARRAY['USDT'],
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    INSERT INTO p2p_settings (id, enabled_coins)
    VALUES (1, ARRAY['USDT'])
    ON CONFLICT (id) DO NOTHING
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS p2p_verified_users (
      user_id VARCHAR(255) PRIMARY KEY,
      note TEXT,
      verified_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS p2p_payment_details (
      user_id VARCHAR(255) NOT NULL,
      method VARCHAR(100) NOT NULL,
      details JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, method)
    )
  `);
}

export async function initNotifications() {
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      type VARCHAR(30) NOT NULL DEFAULT 'system',
      icon VARCHAR(50),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS notification_reads (
      notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL,
      read_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (notification_id, user_id)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS notification_dismissals (
      notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL,
      dismissed_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (notification_id, user_id)
    )
  `);
  const existing = await query(`SELECT COUNT(*) as cnt FROM notifications`);
  if (parseInt(existing[0]?.cnt ?? "0") === 0) {
    await query(`
      INSERT INTO notifications (title, body, type, icon) VALUES
      ('Welcome to CryptoX!', 'Your account is set up and ready. Start trading with live market data.', 'system', 'star'),
      ('BTC all-time high approaching', 'Bitcoin is up +4.1% today and nearing key resistance at $75,000.', 'price', 'trending-up'),
      ('Staking rewards accruing', 'Your ETH staking position is earning 4.2% APY. Rewards update daily.', 'staking', 'percent'),
      ('New earn products available', 'INJ High Yield Staking at 22.5% APY is now live. Subscribe today.', 'promo', 'gift')
    `);
  }
}

export async function initKyc() {
  await query(`
    CREATE TABLE IF NOT EXISTS kyc_submissions (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      level INTEGER NOT NULL CHECK (level IN (1, 2)),
      status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      date_of_birth VARCHAR(20),
      nationality VARCHAR(100),
      country VARCHAR(100),
      address TEXT,
      document_type VARCHAR(30),
      document_front TEXT,
      document_back TEXT,
      selfie TEXT,
      rejection_reason TEXT,
      reviewed_by VARCHAR(255),
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS kyc_user_id_idx ON kyc_submissions (user_id)
  `);
}

export async function initCustomAssets() {
  await query(`
    CREATE TABLE IF NOT EXISTS custom_assets (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      chain VARCHAR(50) NOT NULL DEFAULT 'EVM',
      contract_address VARCHAR(255),
      decimals INTEGER NOT NULL DEFAULT 18,
      logo_url TEXT,
      key_ref VARCHAR(100),
      min_deposit DECIMAL(20,8) NOT NULL DEFAULT 0,
      min_withdrawal DECIMAL(20,8) NOT NULL DEFAULT 0,
      withdrawal_fee DECIMAL(20,8) NOT NULL DEFAULT 0,
      enabled BOOLEAN NOT NULL DEFAULT true,
      listed BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function initLiquidityWallets() {
  await query(`
    CREATE TABLE IF NOT EXISTS liquidity_wallets (
      id SERIAL PRIMARY KEY,
      coin VARCHAR(20) NOT NULL,
      network VARCHAR(50) NOT NULL,
      address VARCHAR(255) NOT NULL,
      key_ref VARCHAR(100),
      balance DECIMAL(30,8) DEFAULT 0,
      balance_usd DECIMAL(20,2) DEFAULT 0,
      low_threshold DECIMAL(30,8) DEFAULT 0,
      last_checked TIMESTAMPTZ,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(coin, network)
    )
  `);
}

export async function initMMBot() {
  await query(`
    CREATE TABLE IF NOT EXISTS mm_bot_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      active BOOLEAN NOT NULL DEFAULT false,
      spread_pct DECIMAL(10,4) NOT NULL DEFAULT 0.5,
      order_size_usd DECIMAL(20,2) NOT NULL DEFAULT 100,
      active_coins TEXT[] NOT NULL DEFAULT ARRAY['BTC','ETH','USDT'],
      refresh_secs INTEGER NOT NULL DEFAULT 30,
      bot_user_id VARCHAR(255) NOT NULL DEFAULT 'SYSTEM_MM_BOT',
      usdt_budget DECIMAL(20,2) NOT NULL DEFAULT 10000,
      total_trades INTEGER NOT NULL DEFAULT 0,
      total_pnl_usd DECIMAL(20,4) NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    INSERT INTO mm_bot_config (id) VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `);
}

export async function initDepositScanLog() {
  await query(`
    CREATE TABLE IF NOT EXISTS deposit_scan_log (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      coin VARCHAR(20) NOT NULL,
      network VARCHAR(50) NOT NULL,
      deposit_address VARCHAR(255) NOT NULL,
      amount DECIMAL(30,8),
      tx_hash VARCHAR(255),
      confirmations INTEGER NOT NULL DEFAULT 0,
      required_confirmations INTEGER NOT NULL DEFAULT 3,
      status VARCHAR(20) NOT NULL DEFAULT 'detected'
        CHECK (status IN ('detected','confirming','confirmed','credited','failed')),
      detected_at TIMESTAMPTZ DEFAULT NOW(),
      credited_at TIMESTAMPTZ
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS deposit_scan_user_idx ON deposit_scan_log (user_id)
  `);
}

export async function initAdminUsers() {
  await query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      user_id VARCHAR(255) PRIMARY KEY,
      granted_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function initReferral() {
  await query(`
    CREATE TABLE IF NOT EXISTS referral_events (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      reward_type VARCHAR(30) NOT NULL DEFAULT 'fixed_usdt',
      referrer_reward NUMERIC(18,8) NOT NULL DEFAULT 10,
      referrer_coin VARCHAR(20) NOT NULL DEFAULT 'USDT',
      referee_bonus NUMERIC(18,8) NOT NULL DEFAULT 0,
      referee_coin VARCHAR(20) NOT NULL DEFAULT 'USDT',
      kickback_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
      min_trade_volume NUMERIC(18,8) NOT NULL DEFAULT 0,
      kyc_required BOOLEAN NOT NULL DEFAULT false,
      max_referrals_per_user INTEGER NOT NULL DEFAULT 0,
      total_budget NUMERIC(18,8) NOT NULL DEFAULT 0,
      spent_budget NUMERIC(18,8) NOT NULL DEFAULT 0,
      starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ends_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS referral_codes (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL UNIQUE,
      code VARCHAR(20) NOT NULL UNIQUE,
      custom_code VARCHAR(20),
      total_referrals INTEGER NOT NULL DEFAULT 0,
      qualified_referrals INTEGER NOT NULL DEFAULT 0,
      total_earned NUMERIC(18,8) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS referral_codes_code_idx ON referral_codes (code)`);
  await query(`
    CREATE TABLE IF NOT EXISTS referral_records (
      id SERIAL PRIMARY KEY,
      referrer_id VARCHAR(255) NOT NULL,
      referee_id VARCHAR(255) NOT NULL,
      code VARCHAR(20) NOT NULL,
      event_id INTEGER REFERENCES referral_events(id),
      status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','qualified','rewarded','expired')),
      trade_volume NUMERIC(18,8) NOT NULL DEFAULT 0,
      referrer_reward NUMERIC(18,8) NOT NULL DEFAULT 0,
      referee_bonus NUMERIC(18,8) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      qualified_at TIMESTAMPTZ,
      rewarded_at TIMESTAMPTZ,
      UNIQUE (referrer_id, referee_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS referral_records_referrer_idx ON referral_records (referrer_id)`);
  await query(`CREATE INDEX IF NOT EXISTS referral_records_referee_idx ON referral_records (referee_id)`);
}

export async function initTradableCoins() {
  await query(`
    CREATE TABLE IF NOT EXISTS tradable_coins (
      coin VARCHAR(20) PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT true,
      label VARCHAR(100),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  for (const coin of ALL_SUPPORTED_COINS) {
    await query(
      `INSERT INTO tradable_coins (coin, enabled, label)
       VALUES ($1, true, $1)
       ON CONFLICT (coin) DO NOTHING`,
      [coin]
    );
  }
}

export default pool;
