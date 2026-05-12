import { hmac } from "@noble/hashes/hmac.js";
import { sha1 } from "@noble/hashes/legacy.js";
import * as Crypto from "expo-crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += B32[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (let i = 0; i < clean.length; i++) {
    const idx = B32.indexOf(clean[i]);
    if (idx < 0) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export function generateTotpSecret(byteLength = 20): string {
  const bytes = Crypto.getRandomBytes(byteLength);
  return base32Encode(bytes);
}

export function formatSecretGroups(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

function counterBytes(counter: number): Uint8Array {
  const buf = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  return buf;
}

export function totpAt(secretBase32: string, timestampMs: number, period = 30, digits = 6): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(timestampMs / 1000 / period);
  const mac = hmac(sha1, key, counterBytes(counter));
  const offset = mac[mac.length - 1] & 0x0f;
  const code =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  const mod = code % 10 ** digits;
  return mod.toString().padStart(digits, "0");
}

export function verifyTotp(
  secretBase32: string,
  token: string,
  opts: { window?: number; period?: number; digits?: number; nowMs?: number } = {}
): boolean {
  const window = opts.window ?? 1;
  const period = opts.period ?? 30;
  const digits = opts.digits ?? 6;
  const now = opts.nowMs ?? Date.now();
  const cleaned = token.replace(/\s/g, "");
  if (!/^\d+$/.test(cleaned) || cleaned.length !== digits) return false;
  for (let i = -window; i <= window; i++) {
    const t = now + i * period * 1000;
    if (totpAt(secretBase32, t, period, digits) === cleaned) return true;
  }
  return false;
}

export function buildOtpAuthUri(params: {
  issuer: string;
  account: string;
  secretBase32: string;
  digits?: number;
  period?: number;
}): string {
  const { issuer, account, secretBase32, digits = 6, period = 30 } = params;
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const query = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = Crypto.getRandomBytes(5);
    let n = 0;
    for (let j = 0; j < bytes.length; j++) n = n * 256 + bytes[j];
    const s = (n % 100000000).toString().padStart(8, "0");
    codes.push(`${s.slice(0, 4)}-${s.slice(4)}`);
  }
  return codes;
}

export function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, "");
}
