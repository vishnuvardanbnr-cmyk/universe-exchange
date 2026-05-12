export interface MarketCoin {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  logo: string;
  color: string;
}

export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

export const MARKET_DATA: MarketCoin[] = [
  { symbol: "BTC", name: "Bitcoin", price: 67420, change24h: 2.4, volume24h: 28400000000, marketCap: 1320000000000, high24h: 68100, low24h: 65800, logo: "₿", color: "#F7931A" },
  { symbol: "ETH", name: "Ethereum", price: 3541, change24h: 1.8, volume24h: 14200000000, marketCap: 425000000000, high24h: 3620, low24h: 3480, logo: "Ξ", color: "#627EEA" },
  { symbol: "BNB", name: "BNB", price: 412, change24h: -0.6, volume24h: 1820000000, marketCap: 63400000000, high24h: 425, low24h: 408, logo: "B", color: "#F0B90B" },
  { symbol: "SOL", name: "Solana", price: 182, change24h: 5.2, volume24h: 4100000000, marketCap: 79200000000, high24h: 188, low24h: 173, logo: "◎", color: "#9945FF" },
  { symbol: "XRP", name: "XRP", price: 0.72, change24h: 1.4, volume24h: 1900000000, marketCap: 38400000000, high24h: 0.74, low24h: 0.70, logo: "X", color: "#346AA9" },
  { symbol: "ADA", name: "Cardano", price: 0.62, change24h: -1.2, volume24h: 420000000, marketCap: 21800000000, high24h: 0.64, low24h: 0.61, logo: "₳", color: "#0033AD" },
  { symbol: "DOGE", name: "Dogecoin", price: 0.168, change24h: -0.8, volume24h: 820000000, marketCap: 23800000000, high24h: 0.174, low24h: 0.163, logo: "D", color: "#C3A634" },
  { symbol: "AVAX", name: "Avalanche", price: 41.2, change24h: 3.1, volume24h: 580000000, marketCap: 16900000000, high24h: 42.5, low24h: 39.8, logo: "A", color: "#E84142" },
  { symbol: "TRX", name: "TRON", price: 0.138, change24h: 2.1, volume24h: 980000000, marketCap: 12100000000, high24h: 0.142, low24h: 0.135, logo: "T", color: "#FF0013" },
  { symbol: "DOT", name: "Polkadot", price: 9.8, change24h: -0.4, volume24h: 320000000, marketCap: 12300000000, high24h: 10.1, low24h: 9.6, logo: "●", color: "#E6007A" },
  { symbol: "MATIC", name: "Polygon", price: 1.12, change24h: 2.8, volume24h: 580000000, marketCap: 10400000000, high24h: 1.18, low24h: 1.09, logo: "M", color: "#8247E5" },
  { symbol: "LINK", name: "Chainlink", price: 18.4, change24h: 4.2, volume24h: 890000000, marketCap: 10200000000, high24h: 19.1, low24h: 17.6, logo: "⬡", color: "#2A5ADA" },
  { symbol: "LTC", name: "Litecoin", price: 92.4, change24h: 0.9, volume24h: 510000000, marketCap: 6800000000, high24h: 94.1, low24h: 91.2, logo: "Ł", color: "#345D9D" },
  { symbol: "ATOM", name: "Cosmos", price: 11.8, change24h: -1.6, volume24h: 280000000, marketCap: 4600000000, high24h: 12.2, low24h: 11.5, logo: "⚛", color: "#2E3148" },
  { symbol: "UNI", name: "Uniswap", price: 11.2, change24h: -2.1, volume24h: 290000000, marketCap: 6700000000, high24h: 11.8, low24h: 10.9, logo: "U", color: "#FF007A" },
  { symbol: "NEAR", name: "NEAR Protocol", price: 7.42, change24h: 6.1, volume24h: 420000000, marketCap: 7900000000, high24h: 7.85, low24h: 6.98, logo: "N", color: "#00C08B" },
  { symbol: "ARB", name: "Arbitrum", price: 1.84, change24h: 3.4, volume24h: 380000000, marketCap: 2300000000, high24h: 1.92, low24h: 1.78, logo: "⬡", color: "#28A0F0" },
  { symbol: "OP", name: "Optimism", price: 2.98, change24h: 4.8, volume24h: 310000000, marketCap: 3100000000, high24h: 3.12, low24h: 2.85, logo: "O", color: "#FF0420" },
  { symbol: "APT", name: "Aptos", price: 12.6, change24h: 7.2, volume24h: 520000000, marketCap: 5400000000, high24h: 13.2, low24h: 11.8, logo: "◈", color: "#2AA3EF" },
  { symbol: "SUI", name: "Sui", price: 2.14, change24h: 8.4, volume24h: 680000000, marketCap: 5800000000, high24h: 2.28, low24h: 1.96, logo: "S", color: "#6FBCF0" },
  { symbol: "INJ", name: "Injective", price: 34.8, change24h: 5.6, volume24h: 290000000, marketCap: 3200000000, high24h: 36.2, low24h: 33.1, logo: "I", color: "#00F2FE" },
  { symbol: "USDT", name: "Tether", price: 1.0, change24h: 0.01, volume24h: 56000000000, marketCap: 91000000000, high24h: 1.001, low24h: 0.999, logo: "$", color: "#26A17B" },
  { symbol: "USDC", name: "USD Coin", price: 1.0, change24h: 0.0, volume24h: 8200000000, marketCap: 34000000000, high24h: 1.001, low24h: 0.999, logo: "C", color: "#2775CA" },
];

export function generateOrderBook(basePrice: number): { bids: OrderBookEntry[]; asks: OrderBookEntry[] } {
  const bids: OrderBookEntry[] = [];
  const asks: OrderBookEntry[] = [];
  let bidTotal = 0;
  let askTotal = 0;
  for (let i = 0; i < 15; i++) {
    const bidPrice = basePrice * (1 - (i + 1) * 0.0008 - Math.random() * 0.0002);
    const bidAmount = Math.random() * 2 + 0.1;
    bidTotal += bidAmount;
    bids.push({ price: bidPrice, amount: bidAmount, total: bidTotal });

    const askPrice = basePrice * (1 + (i + 1) * 0.0008 + Math.random() * 0.0002);
    const askAmount = Math.random() * 2 + 0.1;
    askTotal += askAmount;
    asks.push({ price: askPrice, amount: askAmount, total: askTotal });
  }
  return { bids, asks };
}

export function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

export function formatVolume(vol: number): string {
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
  return `$${(vol / 1e3).toFixed(0)}K`;
}

export function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  return `$${(cap / 1e6).toFixed(0)}M`;
}

export const STAKING_PRODUCTS = [
  { symbol: "ETH", name: "Ethereum 2.0 Staking", apy: 4.2, minAmount: 0.01, lockDays: 0, type: "staking" as const, tag: "Popular" },
  { symbol: "BNB", name: "BNB Staking", apy: 6.8, minAmount: 0.1, lockDays: 0, type: "staking" as const, tag: "" },
  { symbol: "SOL", name: "Solana Staking", apy: 7.1, minAmount: 0.1, lockDays: 0, type: "staking" as const, tag: "High APY" },
  { symbol: "DOT", name: "Polkadot Staking", apy: 12.4, minAmount: 1, lockDays: 28, type: "staking" as const, tag: "" },
  { symbol: "ADA", name: "Cardano Staking", apy: 4.6, minAmount: 10, lockDays: 0, type: "staking" as const, tag: "" },
  { symbol: "ATOM", name: "Cosmos Staking", apy: 19.2, minAmount: 1, lockDays: 21, type: "staking" as const, tag: "Hot" },
  { symbol: "NEAR", name: "NEAR Staking", apy: 10.8, minAmount: 1, lockDays: 0, type: "staking" as const, tag: "" },
];

export const LIQUID_STAKING_PRODUCTS = [
  { symbol: "ETH", name: "stETH (Lido)", apy: 4.1, minAmount: 0.01, lockDays: 0, type: "liquid" as const, tag: "Most Liquid" },
  { symbol: "SOL", name: "mSOL (Marinade)", apy: 6.9, minAmount: 0.1, lockDays: 0, type: "liquid" as const, tag: "" },
  { symbol: "BNB", name: "WBETH (Wrapped)", apy: 5.2, minAmount: 0.01, lockDays: 0, type: "liquid" as const, tag: "" },
  { symbol: "DOT", name: "lcDOT (Liquid)", apy: 11.8, minAmount: 1, lockDays: 0, type: "liquid" as const, tag: "" },
  { symbol: "MATIC", name: "stMATIC (Lido)", apy: 5.4, minAmount: 1, lockDays: 0, type: "liquid" as const, tag: "" },
];

export const EARN_PRODUCTS = [
  { symbol: "USDT", name: "USDT Flexible Savings", apy: 8.5, minAmount: 10, lockDays: 0, type: "earn" as const, tag: "Flexible" },
  { symbol: "USDC", name: "USDC Flexible Savings", apy: 8.2, minAmount: 10, lockDays: 0, type: "earn" as const, tag: "Flexible" },
  { symbol: "BTC", name: "BTC 30-Day Fixed", apy: 2.1, minAmount: 0.001, lockDays: 30, type: "earn" as const, tag: "Fixed" },
  { symbol: "ETH", name: "ETH 90-Day Fixed", apy: 5.8, minAmount: 0.01, lockDays: 90, type: "earn" as const, tag: "Fixed" },
  { symbol: "BNB", name: "BNB 60-Day Fixed", apy: 9.4, minAmount: 0.1, lockDays: 60, type: "earn" as const, tag: "Fixed" },
  { symbol: "SOL", name: "SOL 30-Day Fixed", apy: 8.1, minAmount: 0.5, lockDays: 30, type: "earn" as const, tag: "Fixed" },
  { symbol: "XRP", name: "XRP Flexible Savings", apy: 4.8, minAmount: 10, lockDays: 0, type: "earn" as const, tag: "Flexible" },
];

import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import * as Crypto from "expo-crypto";

export const SEED_WORDS = wordlist;

export function generateSeedPhrase(): string[] {
  const entropy = Crypto.getRandomBytes(16);
  const mnemonic = bip39.entropyToMnemonic(entropy, wordlist);
  return mnemonic.split(" ");
}

export function isValidMnemonic(words: string[]): boolean {
  try {
    return bip39.validateMnemonic(words.join(" "), wordlist);
  } catch {
    return false;
  }
}

export async function deriveAddressFromMnemonic(words: string[]): Promise<string> {
  const seed = words.join(" ").trim().toLowerCase();
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, "ethaddr:" + seed);
  return "0x" + hash.slice(0, 40);
}
