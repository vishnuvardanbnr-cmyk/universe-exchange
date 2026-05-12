import { createHash } from "crypto";

export interface NetworkConfig {
  network: string;
  label: string;
  memoRequired?: boolean;
  addressType: "eth" | "btc" | "sol" | "xrp" | "ada" | "dot" | "trx" | "ltc" | "atom" | "doge" | "apt" | "sui" | "inj";
}

export const COIN_NETWORKS: Record<string, NetworkConfig[]> = {
  BTC:   [{ network: "BITCOIN",   label: "Bitcoin (Native SegWit)", addressType: "btc" }],
  ETH:   [
    { network: "ERC20",     label: "Ethereum (ERC-20)",          addressType: "eth" },
    { network: "ARBITRUM",  label: "Arbitrum One",                addressType: "eth" },
    { network: "OPTIMISM",  label: "Optimism",                    addressType: "eth" },
  ],
  BNB:   [{ network: "BEP20",     label: "BNB Smart Chain (BEP-20)",  addressType: "eth" }],
  SOL:   [{ network: "SOLANA",    label: "Solana",                     addressType: "sol" }],
  USDT:  [
    { network: "ERC20",     label: "Ethereum (ERC-20)",          addressType: "eth" },
    { network: "TRC20",     label: "Tron (TRC-20)",               addressType: "trx" },
    { network: "BEP20",     label: "BNB Smart Chain (BEP-20)",   addressType: "eth" },
    { network: "SOLANA",    label: "Solana",                      addressType: "sol" },
  ],
  USDC:  [
    { network: "ERC20",     label: "Ethereum (ERC-20)",          addressType: "eth" },
    { network: "SOLANA",    label: "Solana",                      addressType: "sol" },
    { network: "BEP20",     label: "BNB Smart Chain (BEP-20)",   addressType: "eth" },
    { network: "ARBITRUM",  label: "Arbitrum One",                addressType: "eth" },
  ],
  XRP:   [{ network: "XRP",       label: "XRP Ledger",                addressType: "xrp",  memoRequired: true }],
  ADA:   [{ network: "CARDANO",   label: "Cardano",                   addressType: "ada" }],
  DOGE:  [{ network: "DOGECOIN",  label: "Dogecoin",                  addressType: "doge" }],
  AVAX:  [{ network: "AVAXC",     label: "Avalanche C-Chain",         addressType: "eth" }],
  TRX:   [{ network: "TRC20",     label: "Tron (TRC-20)",             addressType: "trx" }],
  LTC:   [{ network: "LITECOIN",  label: "Litecoin",                  addressType: "ltc" }],
  MATIC: [
    { network: "POLYGON",   label: "Polygon (MATIC)",             addressType: "eth" },
    { network: "ERC20",     label: "Ethereum (ERC-20)",           addressType: "eth" },
  ],
  LINK:  [
    { network: "ERC20",     label: "Ethereum (ERC-20)",           addressType: "eth" },
    { network: "BEP20",     label: "BNB Smart Chain (BEP-20)",   addressType: "eth" },
  ],
  ATOM:  [{ network: "COSMOS",    label: "Cosmos Hub",                addressType: "atom", memoRequired: true }],
  DOT:   [{ network: "POLKADOT",  label: "Polkadot",                  addressType: "dot" }],
  UNI:   [
    { network: "ERC20",     label: "Ethereum (ERC-20)",           addressType: "eth" },
    { network: "BEP20",     label: "BNB Smart Chain (BEP-20)",   addressType: "eth" },
  ],
  NEAR:  [{ network: "NEAR",      label: "NEAR Protocol",             addressType: "sol" }],
  ARB:   [{ network: "ARBITRUM",  label: "Arbitrum One",              addressType: "eth" }],
  OP:    [{ network: "OPTIMISM",  label: "Optimism",                  addressType: "eth" }],
  APT:   [{ network: "APTOS",     label: "Aptos",                     addressType: "apt" }],
  SUI:   [{ network: "SUI",       label: "Sui Network",               addressType: "sui" }],
  INJ:   [
    { network: "INJECTIVE", label: "Injective",                   addressType: "inj" },
    { network: "ERC20",     label: "Ethereum (ERC-20)",           addressType: "eth" },
  ],
};

const BASE58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function toBase58(bytes: Buffer, len: number): string {
  let result = "";
  let num = BigInt("0x" + bytes.toString("hex"));
  while (result.length < len) {
    result = BASE58_CHARS[Number(num % 58n)] + result;
    num = num / 58n;
  }
  return result;
}

export function generateDepositAddress(userId: string, coin: string, network: string): { address: string; memo?: string } {
  const seed = `${userId}:${coin}:${network}`;
  const h = createHash("sha256").update(seed).digest("hex");
  const h2 = createHash("sha256").update(seed + "2").digest("hex");

  const cfg = COIN_NETWORKS[coin]?.find((n) => n.network === network);
  const addrType = cfg?.addressType ?? "eth";

  let address: string;
  let memo: string | undefined;

  switch (addrType) {
    case "eth":
      address = "0x" + h.slice(0, 40);
      break;
    case "btc":
      address = "bc1q" + h.slice(0, 38).replace(/[^a-z0-9]/gi, "a").toLowerCase();
      break;
    case "ltc":
      address = "ltc1q" + h.slice(0, 37).replace(/[^a-z0-9]/gi, "a").toLowerCase();
      break;
    case "doge":
      address = "D" + toBase58(Buffer.from(h, "hex"), 33);
      break;
    case "sol":
      address = toBase58(Buffer.from(h, "hex"), 44);
      break;
    case "trx":
      address = "T" + h.slice(0, 33).replace(/[^A-Za-z0-9]/g, "x");
      break;
    case "xrp":
      address = "r" + h.slice(0, 33).replace(/[^A-Za-z0-9]/g, "x");
      memo = String(parseInt(h2.slice(0, 8), 16) % 1000000000);
      break;
    case "ada":
      address = "addr1q" + h.slice(0, 51).replace(/[^a-z0-9]/gi, "a").toLowerCase();
      break;
    case "atom":
      address = "cosmos1" + h.slice(0, 38).replace(/[^a-z0-9]/gi, "a").toLowerCase();
      memo = String(parseInt(h2.slice(0, 8), 16) % 1000000);
      break;
    case "dot":
      address = "1" + toBase58(Buffer.from(h, "hex"), 47);
      break;
    case "apt":
      address = "0x" + h.slice(0, 64);
      break;
    case "sui":
      address = "0x" + h.slice(0, 64);
      break;
    case "inj":
      address = "inj1" + h.slice(0, 38).replace(/[^a-z0-9]/gi, "a").toLowerCase();
      break;
    default:
      address = "0x" + h.slice(0, 40);
  }

  return { address, memo };
}
