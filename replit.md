# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### CryptoX Exchange (`artifacts/crypto-exchange`)
- Expo/React Native mobile app with 5 tabs: Markets, Trade, Swap, Earn, Wallet
- Professional dark-theme Binance-style UI
- DEX wallet flow: seed phrase generation → verification → activation
- CEX wallet: real custodial system backed by PostgreSQL

#### Real Custodial Wallet System (Binance-style)
- `context/UserWalletContext.tsx` — fetches real DB balances, deposit address, networks, submit deposit/withdrawal
- **DB tables**: `user_balances`, `user_deposit_addresses`, `admin_deposit_addresses`, `deposit_requests`, `withdrawal_requests`
- **Deposit model**: each user gets their own unique address per coin/network (deterministic, stored in DB); admin monitors those and sweeps funds to admin hot wallet, then credits the user
- **Supported networks**: defined in `src/lib/depositNetworks.ts` (15 coins, 24 networks); XRP/ATOM auto-generate a unique memo/tag
- **API routes**: `GET /api/wallet/balances`, `GET /api/wallet/deposit-address/:coin?network=`, `GET /api/wallet/deposit-networks/:coin`, `POST /api/wallet/deposit-request`, `POST /api/wallet/withdraw`
- CEX Wallet tab shows real balances from DB, sorted by USD value descending
- Deposit modal: coin → network → user's unique address with copy button + "Unique to you" badge
- Withdraw modal: uses real `submitWithdrawal`, moves balance from available→locked
- Auth: `x-user-id` header (user's ID from AsyncStorage)

#### Admin Panel (`app/admin.tsx`)
- Accessible via Settings → Admin Panel
- Key-gated (`cryptox-admin-2024`)
- **Credit User Balance**: credit any coin to any user ID immediately after deposit confirmation
- **User Deposit Addresses**: view every user's unique per-coin/network address with filter by coin — lets admin match incoming on-chain transactions to users
- **Admin Hot Wallet**: configure admin's own wallet addresses (where funds are swept to)
- **Deposit Requests**: view all user deposit notifications
- **Withdrawal Requests**: view + approve (deducts locked balance, marks approved)
- Admin API: `POST /api/admin/credit`, `GET /api/admin/user-deposit-addresses`, `GET|POST /api/admin/deposit-addresses`, `GET /api/admin/deposits`, `GET /api/admin/withdrawals`, `POST /api/admin/withdrawals/:id/approve`, `POST /api/admin/withdrawals/:id/reject`, `POST /api/admin/withdrawals/:id/process`
- Admin key: `cryptox-admin-2024` (header: `X-Admin-Key`)

#### Custom Asset Registry (`artifacts/api-server/src/routes/adminAssets.ts`)
- DB table: `custom_assets` — symbol, name, chain, contract_address, decimals, logo_url, key_ref, min_deposit, min_withdrawal, withdrawal_fee, enabled, listed
- CRUD: `GET|POST /api/admin/assets`, `PUT /api/admin/assets/:id`, `DELETE /api/admin/assets/:id`, `PATCH /api/admin/assets/:id/toggle`
- Admin UI: "Custom Assets" panel — form to add/edit tokens, enable/disable/list/unlist toggles, per-row key_ref badge and fee display

#### Blockchain Deposit Listener (`artifacts/api-server/src/routes/adminLiquidity.ts`)
- DB table: `deposit_scan_log` — per-deposit detection, confirmation tracking, credit status
- `POST /api/admin/blockchain/scan` — simulates scanning all known user deposit addresses; randomly detects simulated incoming transactions
- `POST /api/admin/blockchain/deposits/:id/advance` — advance confirmation count (+1 block per press)
- `POST /api/admin/blockchain/deposits/:id/confirm` — manually credit user balance once confirmed
- Admin UI: "Blockchain Deposits" panel — status filter chips, confirmation progress dots, +1 Block / Credit User action buttons

#### Liquidity Dashboard (`artifacts/api-server/src/routes/adminLiquidity.ts`)
- DB table: `liquidity_wallets` — coin, network, address, key_ref, balance, balance_usd, low_threshold, last_checked
- `GET /api/admin/liquidity` — list wallets + total_usd aggregate
- `POST /api/admin/liquidity` — upsert wallet (coin+network UNIQUE)
- `PATCH /api/admin/liquidity/:id/balance` — update balance snapshot
- `DELETE /api/admin/liquidity/:id` — remove wallet
- Admin UI: total USD banner, per-wallet balance card with LOW badge when balance ≤ threshold, key_ref display

#### Market Making Bot (`artifacts/api-server/src/routes/adminLiquidity.ts`)
- DB table: `mm_bot_config` — single row: active, spread_pct, order_size_usd, active_coins[], refresh_secs, usdt_budget, total_trades, total_pnl_usd
- `GET /api/admin/mm-bot` — read config
- `POST /api/admin/mm-bot` — update config fields
- `POST /api/admin/mm-bot/toggle` — flip active flag
- Admin UI: running/stopped status banner, Start/Stop button, stats (trades + P&L), config form, coin chip manager (add/remove active coins)

#### P2P Trading System (`app/p2p.tsx`)
- Full Binance-style peer-to-peer marketplace accessible via Wallet tab banner or `/p2p` route
- **DB tables**: `p2p_ads`, `p2p_orders`, `p2p_messages` (auto-created on startup via `initP2P()`)
- **Ad types**: `sell` (merchant sells crypto to buyer) and `buy` (merchant wants to buy crypto)
- **Supported coins**: USDT, BTC, ETH, BNB, SOL, XRP
- **Payment methods**: Bank Transfer, PayPal, Revolut, Wise, Cash App, Zelle, Venmo, Cash (In Person)
- **Escrow mechanism**: sell ad creation locks funds from `user_balances.available` → `locked`; release moves from seller `locked` → buyer `available`
- **Flows**: Browse ads (Buy/Sell toggle + coin filter + payment filter) → Place order → Pay → Release/Dispute
- **Order statuses**: `pending` → `paid` → `released` | `cancelled` | `disputed` → `resolved`
- **Chat**: real-time in-order chat between buyer and seller (polling every 5s)
- **Dispute system**: either party can open a dispute; admin resolves via force-release or refund
- **Admin P2P panels**: P2P Ads (view/pause/admin-pause/delete all ads) + P2P Orders & Disputes (monitor orders, resolve disputes with "Release to Buyer" or "Refund to Seller")
- **User API routes**: `GET /api/p2p/ads`, `GET /api/p2p/ads/mine`, `POST /api/p2p/ads`, `PATCH /api/p2p/ads/:id/toggle`, `DELETE /api/p2p/ads/:id`, `POST /api/p2p/orders`, `GET /api/p2p/orders`, `GET /api/p2p/orders/:id`, `POST /api/p2p/orders/:id/pay|release|cancel|dispute`, `GET|POST /api/p2p/orders/:id/messages`
- **Admin API routes**: `GET /api/admin/p2p/stats`, `GET /api/admin/p2p/ads`, `PATCH /api/admin/p2p/ads/:id/status`, `GET /api/admin/p2p/orders`, `POST /api/admin/p2p/orders/:id/resolve`

#### Auth System (`context/AuthContext.tsx`, `app/auth.tsx`)
- Single auth page: shows login or register based on user state toggle
- Multiple methods: Email/Password, Google, Apple (iOS), Phone+OTP
- Accounts can link/unlink multiple auth methods from Settings
- Persisted in AsyncStorage (`cryptox_user_v1`, `cryptox_users_db_v1`)

#### Notifications (`context/NotificationsContext.tsx`, `app/(tabs)/notifications.tsx`)
- Full notification history with date grouping
- Types: trade, price, staking, system, security, promo
- Filter by type, mark all read, delete, clear all
- Unread badge on bell icon in Markets and Wallet headers
- Persisted in AsyncStorage (`cryptox_notifications_v1`)

#### Support (Live WebSocket Chat)
- `app/support.tsx` — create tickets, live chat, view ticket history
- `artifacts/api-server/src/lib/supportSocket.ts` — WebSocket at `/api/ws/support`
- `artifacts/api-server/src/routes/support.ts` — REST: create/list/update tickets
- Real-time typing indicators, message delivery, status changes
- Admin can join tickets via `?adminKey=cryptox-admin-2024`

#### Settings (`app/settings.tsx`)
- Profile: edit display name, view join date
- Notifications: push/price alert toggles
- Security: real RFC 6238 TOTP 2FA (HMAC-SHA1, base32, ±30s window) with QR code setup, persistent secret per user, single-use backup codes (consumed on login), login challenge gate, change password, login history
- Linked Accounts: link/unlink email, Google, Apple, Phone
- Preferences: currency picker (10 currencies), language picker (8 languages)
- Admin Panel link (gated by admin key)
- Sign out with confirmation

#### Terms & Conditions (`app/terms.tsx`)
- 15 expandable sections covering all legal topics
- Links to support from footer

### API Server (`artifacts/api-server`)
- Express 5 server at `/api` path (port 8080)
- **Live price WebSocket** at `/api/ws/prices` — broadcasts live ticker data to connected clients
- **REST price endpoint** at `/api/prices` — returns latest ticker snapshot for polling

## Live Price Architecture

Binance WebSocket (`wss://stream.binance.com`) is geo-blocked (HTTP 451) from Replit.
Solution: server-side price proxy using two sources:

1. **CryptoCompare** (`min-api.cryptocompare.com/data/pricemultifull`) — every 10s
   - Full market data: price, 24h change%, 24h high/low, volume
   - No API key required, generous free tier
2. **Coinbase** (`api.coinbase.com/v2/exchange-rates`) — every 5s
   - Fast price updates between CryptoCompare cycles
   - Single request returns all coin rates

### Client Connection (`context/LivePriceContext.tsx`)
1. Connects WebSocket to `wss://${EXPO_PUBLIC_DOMAIN}/api/ws/prices`
2. Falls back to REST polling `https://${EXPO_PUBLIC_DOMAIN}/api/prices` every 3s if WebSocket unavailable
3. Shows green "● Live" badge when connected, "Connecting..." when not

### Tracked Coins (21)
BTC, ETH, BNB, SOL, XRP, ADA, DOGE, AVAX, TRX, DOT, MATIC, LINK, LTC, ATOM, UNI, NEAR, ARB, OP, APT, SUI, INJ
