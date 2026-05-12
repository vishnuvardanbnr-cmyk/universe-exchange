import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { generateSeedPhrase, isValidMnemonic, deriveAddressFromMnemonic } from "@/data/marketData";

export interface CoinBalance {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  logo: string;
  color: string;
  change24h: number;
}

export interface Transaction {
  id: string;
  type: "buy" | "sell" | "swap" | "stake" | "unstake" | "earn" | "withdraw" | "deposit";
  symbol: string;
  amount: number;
  usdValue: number;
  timestamp: number;
  status: "completed" | "pending" | "failed";
}

export interface StakePosition {
  id: string;
  symbol: string;
  amount: number;
  apy: number;
  earnedRewards: number;
  startDate: number;
  type: "staking" | "liquid" | "earn";
  duration?: number;
  lockEnd?: number;
}

export interface DexTx {
  id: string;
  hash: string;
  kind: "send" | "receive" | "swap" | "approve" | "contract" | "deposit";
  symbol: string;
  amount: number;
  usdValue: number;
  to?: string;
  from?: string;
  network: string;
  gasFee: number;
  timestamp: number;
  status: "completed" | "pending" | "failed";
  note?: string;
}

export interface ConnectedDapp {
  id: string;
  name: string;
  url: string;
  icon: string;
  category: string;
  network: string;
  connectedAt: number;
}

interface WalletState {
  cexBalances: CoinBalance[];
  dexBalances: CoinBalance[];
  transactions: Transaction[];
  stakePositions: StakePosition[];
  totalCexUsd: number;
  totalDexUsd: number;
  // DEX wallet
  dexCreated: boolean;
  dexAddress: string;
  dexSeedPhrase: string[];
  seedConfirmed: boolean;
  dexTxs: DexTx[];
  connectedDapps: ConnectedDapp[];
  walletImported: boolean;
}

interface WalletContextType extends WalletState {
  buyCoin: (symbol: string, usdAmount: number, livePrice?: number) => void;
  sellCoin: (symbol: string, usdAmount: number, livePrice?: number) => void;
  swapCoins: (fromSymbol: string, toSymbol: string, amount: number, fromLivePrice?: number, toLivePrice?: number) => boolean;
  stakeCoins: (symbol: string, amount: number, apy: number, type: StakePosition["type"], duration?: number) => boolean;
  unstakePosition: (id: string) => void;
  createDexWallet: () => Promise<string[]>;
  confirmSeed: () => void;
  importDexWallet: (words: string[]) => Promise<{ ok: boolean; error?: string }>;
  resetDexWallet: () => void;
  depositToDex: (symbol: string, amount: number) => void;
  sendFromDex: (symbol: string, amount: number, toAddress: string, network: string) => { ok: boolean; error?: string; tx?: DexTx };
  connectDapp: (dapp: Omit<ConnectedDapp, "connectedAt">) => void;
  disconnectDapp: (id: string) => void;
}

export const COIN_PRICES: Record<string, number> = {
  BTC: 67420, ETH: 3541, BNB: 412, SOL: 182, XRP: 0.72, ADA: 0.62,
  DOGE: 0.168, AVAX: 41.2, TRX: 0.138, DOT: 9.8, MATIC: 1.12, LINK: 18.4,
  LTC: 92.4, ATOM: 11.8, UNI: 11.2, NEAR: 7.42, ARB: 1.84, OP: 2.98,
  APT: 12.6, SUI: 2.14, INJ: 34.8, USDT: 1.0, USDC: 1.0,
};

export const COIN_NAMES: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", BNB: "BNB", SOL: "Solana", XRP: "XRP",
  ADA: "Cardano", DOGE: "Dogecoin", AVAX: "Avalanche", TRX: "TRON",
  DOT: "Polkadot", MATIC: "Polygon", LINK: "Chainlink", LTC: "Litecoin",
  ATOM: "Cosmos", UNI: "Uniswap", NEAR: "NEAR Protocol", ARB: "Arbitrum",
  OP: "Optimism", APT: "Aptos", SUI: "Sui", INJ: "Injective",
  USDT: "Tether", USDC: "USD Coin",
};

export const COIN_LOGOS: Record<string, string> = {
  BTC: "₿", ETH: "Ξ", BNB: "B", SOL: "◎", XRP: "X", ADA: "₳",
  DOGE: "D", AVAX: "A", TRX: "T", DOT: "●", MATIC: "M", LINK: "⬡",
  LTC: "Ł", ATOM: "⚛", UNI: "U", NEAR: "N", ARB: "⬡", OP: "O",
  APT: "◈", SUI: "S", INJ: "I", USDT: "$", USDC: "C",
};

export const COIN_COLORS: Record<string, string> = {
  BTC: "#F7931A", ETH: "#627EEA", BNB: "#F0B90B", SOL: "#9945FF", XRP: "#346AA9",
  ADA: "#0033AD", DOGE: "#C3A634", AVAX: "#E84142", TRX: "#FF0013", DOT: "#E6007A",
  MATIC: "#8247E5", LINK: "#2A5ADA", LTC: "#345D9D", ATOM: "#2E3148", UNI: "#FF007A",
  NEAR: "#00C08B", ARB: "#28A0F0", OP: "#FF0420", APT: "#2AA3EF", SUI: "#6FBCF0",
  INJ: "#00F2FE", USDT: "#26A17B", USDC: "#2775CA",
};

const INITIAL_CEX: CoinBalance[] = [];


const WalletContext = createContext<WalletContextType>({} as WalletContextType);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    cexBalances: INITIAL_CEX,
    dexBalances: [],
    transactions: [],
    stakePositions: [],
    totalCexUsd: INITIAL_CEX.reduce((s, c) => s + c.usdValue, 0),
    totalDexUsd: 0,
    dexCreated: false,
    dexAddress: "",
    dexSeedPhrase: [],
    seedConfirmed: false,
    dexTxs: [],
    connectedDapps: [],
    walletImported: false,
  });

  useEffect(() => {
    AsyncStorage.getItem("wallet_state_v3").then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          setState((prev) => ({ ...prev, ...saved, dexTxs: saved.dexTxs ?? [], connectedDapps: saved.connectedDapps ?? [], walletImported: saved.walletImported ?? false }));
        } catch {}
      }
    });
  }, []);

  const persist = (newState: WalletState) => {
    AsyncStorage.setItem("wallet_state_v3", JSON.stringify(newState));
  };

  const recalcTotals = (cex: CoinBalance[], dex: CoinBalance[]) => ({
    totalCexUsd: cex.reduce((s, c) => s + c.usdValue, 0),
    totalDexUsd: dex.reduce((s, c) => s + c.usdValue, 0),
  });

  const buyCoin = useCallback((symbol: string, usdAmount: number, livePrice?: number) => {
    setState((prev) => {
      const price = (livePrice && livePrice > 0) ? livePrice : (COIN_PRICES[symbol] ?? 1);
      const coinAmount = usdAmount / price;
      const usdtIdx = prev.cexBalances.findIndex((c) => c.symbol === "USDT");
      if (usdtIdx < 0 || prev.cexBalances[usdtIdx].balance < usdAmount) return prev;
      const newCex = [...prev.cexBalances];
      newCex[usdtIdx] = { ...newCex[usdtIdx], balance: newCex[usdtIdx].balance - usdAmount, usdValue: newCex[usdtIdx].balance - usdAmount };
      const coinIdx = newCex.findIndex((c) => c.symbol === symbol);
      if (coinIdx >= 0) {
        newCex[coinIdx] = { ...newCex[coinIdx], balance: newCex[coinIdx].balance + coinAmount, usdValue: (newCex[coinIdx].balance + coinAmount) * price };
      } else {
        newCex.push({ symbol, name: COIN_NAMES[symbol] ?? symbol, balance: coinAmount, usdValue: usdAmount, logo: COIN_LOGOS[symbol] ?? symbol[0], color: COIN_COLORS[symbol] ?? "#888", change24h: 0 });
      }
      const tx: Transaction = { id: Date.now().toString(), type: "buy", symbol, amount: coinAmount, usdValue: usdAmount, timestamp: Date.now(), status: "completed" };
      const newState = { ...prev, cexBalances: newCex, transactions: [tx, ...prev.transactions], ...recalcTotals(newCex, prev.dexBalances) };
      persist(newState);
      return newState;
    });
  }, []);

  const sellCoin = useCallback((symbol: string, usdAmount: number, livePrice?: number) => {
    setState((prev) => {
      const price = (livePrice && livePrice > 0) ? livePrice : (COIN_PRICES[symbol] ?? 1);
      const coinAmount = usdAmount / price;
      const coinIdx = prev.cexBalances.findIndex((c) => c.symbol === symbol);
      if (coinIdx < 0 || prev.cexBalances[coinIdx].balance < coinAmount) return prev;
      const newCex = [...prev.cexBalances];
      newCex[coinIdx] = { ...newCex[coinIdx], balance: newCex[coinIdx].balance - coinAmount, usdValue: (newCex[coinIdx].balance - coinAmount) * price };
      const usdtIdx = newCex.findIndex((c) => c.symbol === "USDT");
      if (usdtIdx >= 0) {
        newCex[usdtIdx] = { ...newCex[usdtIdx], balance: newCex[usdtIdx].balance + usdAmount, usdValue: newCex[usdtIdx].balance + usdAmount };
      }
      const tx: Transaction = { id: Date.now().toString(), type: "sell", symbol, amount: coinAmount, usdValue: usdAmount, timestamp: Date.now(), status: "completed" };
      const newState = { ...prev, cexBalances: newCex, transactions: [tx, ...prev.transactions], ...recalcTotals(newCex, prev.dexBalances) };
      persist(newState);
      return newState;
    });
  }, []);

  const swapCoins = useCallback((fromSymbol: string, toSymbol: string, amount: number, fromLivePrice?: number, toLivePrice?: number): boolean => {
    let success = false;
    setState((prev) => {
      const fromPrice = (fromLivePrice && fromLivePrice > 0) ? fromLivePrice : (COIN_PRICES[fromSymbol] ?? 1);
      const toPrice = (toLivePrice && toLivePrice > 0) ? toLivePrice : (COIN_PRICES[toSymbol] ?? 1);
      const fromIdx = prev.cexBalances.findIndex((c) => c.symbol === fromSymbol);
      if (fromIdx < 0 || prev.cexBalances[fromIdx].balance < amount) return prev;
      const usdValue = amount * fromPrice;
      const toAmount = usdValue / toPrice;
      const newCex = [...prev.cexBalances];
      newCex[fromIdx] = { ...newCex[fromIdx], balance: newCex[fromIdx].balance - amount, usdValue: (newCex[fromIdx].balance - amount) * fromPrice };
      const toIdx = newCex.findIndex((c) => c.symbol === toSymbol);
      if (toIdx >= 0) {
        newCex[toIdx] = { ...newCex[toIdx], balance: newCex[toIdx].balance + toAmount, usdValue: (newCex[toIdx].balance + toAmount) * toPrice };
      } else {
        newCex.push({ symbol: toSymbol, name: COIN_NAMES[toSymbol] ?? toSymbol, balance: toAmount, usdValue, logo: COIN_LOGOS[toSymbol] ?? toSymbol[0], color: COIN_COLORS[toSymbol] ?? "#888", change24h: 0 });
      }
      const tx: Transaction = { id: Date.now().toString(), type: "swap", symbol: `${fromSymbol}→${toSymbol}`, amount, usdValue, timestamp: Date.now(), status: "completed" };
      const newState = { ...prev, cexBalances: newCex, transactions: [tx, ...prev.transactions], ...recalcTotals(newCex, prev.dexBalances) };
      persist(newState);
      success = true;
      return newState;
    });
    return success;
  }, []);

  const stakeCoins = useCallback((symbol: string, amount: number, apy: number, type: StakePosition["type"], duration?: number): boolean => {
    let success = false;
    setState((prev) => {
      const price = COIN_PRICES[symbol] ?? 1;
      const coinIdx = prev.cexBalances.findIndex((c) => c.symbol === symbol);
      if (coinIdx < 0 || prev.cexBalances[coinIdx].balance < amount) return prev;
      const newCex = [...prev.cexBalances];
      newCex[coinIdx] = { ...newCex[coinIdx], balance: newCex[coinIdx].balance - amount, usdValue: (newCex[coinIdx].balance - amount) * price };
      const pos: StakePosition = {
        id: Date.now().toString(), symbol, amount, apy, earnedRewards: 0,
        startDate: Date.now(), type, duration,
        lockEnd: duration ? Date.now() + duration * 24 * 60 * 60 * 1000 : undefined,
      };
      const tx: Transaction = { id: Date.now().toString() + "t", type: "stake", symbol, amount, usdValue: amount * price, timestamp: Date.now(), status: "completed" };
      const newState = { ...prev, cexBalances: newCex, stakePositions: [...prev.stakePositions, pos], transactions: [tx, ...prev.transactions], ...recalcTotals(newCex, prev.dexBalances) };
      persist(newState);
      success = true;
      return newState;
    });
    return success;
  }, []);

  const unstakePosition = useCallback((id: string) => {
    setState((prev) => {
      const pos = prev.stakePositions.find((p) => p.id === id);
      if (!pos) return prev;
      const price = COIN_PRICES[pos.symbol] ?? 1;
      const returnAmount = pos.amount + pos.earnedRewards;
      const newCex = [...prev.cexBalances];
      const coinIdx = newCex.findIndex((c) => c.symbol === pos.symbol);
      if (coinIdx >= 0) {
        newCex[coinIdx] = { ...newCex[coinIdx], balance: newCex[coinIdx].balance + returnAmount, usdValue: (newCex[coinIdx].balance + returnAmount) * price };
      } else {
        newCex.push({ symbol: pos.symbol, name: COIN_NAMES[pos.symbol] ?? pos.symbol, balance: returnAmount, usdValue: returnAmount * price, logo: COIN_LOGOS[pos.symbol] ?? pos.symbol[0], color: COIN_COLORS[pos.symbol] ?? "#888", change24h: 0 });
      }
      const tx: Transaction = { id: Date.now().toString(), type: "unstake", symbol: pos.symbol, amount: returnAmount, usdValue: returnAmount * price, timestamp: Date.now(), status: "completed" };
      const newState = { ...prev, cexBalances: newCex, stakePositions: prev.stakePositions.filter((p) => p.id !== id), transactions: [tx, ...prev.transactions], ...recalcTotals(newCex, prev.dexBalances) };
      persist(newState);
      return newState;
    });
  }, []);

  const createDexWallet = useCallback(async (): Promise<string[]> => {
    const seed = generateSeedPhrase();
    const address = await deriveAddressFromMnemonic(seed);
    setState((prev) => {
      const newState = { ...prev, dexSeedPhrase: seed, dexAddress: address };
      persist(newState);
      return newState;
    });
    return seed;
  }, []);

  const confirmSeed = useCallback(() => {
    setState((prev) => {
      const newState = { ...prev, dexCreated: true, seedConfirmed: true };
      persist(newState);
      return newState;
    });
  }, []);

  const depositToDex = useCallback((symbol: string, amount: number) => {
    setState((prev) => {
      const price = COIN_PRICES[symbol] ?? 1;
      const cexIdx = prev.cexBalances.findIndex((c) => c.symbol === symbol);
      if (cexIdx < 0 || prev.cexBalances[cexIdx].balance < amount) return prev;
      const newCex = [...prev.cexBalances];
      newCex[cexIdx] = { ...newCex[cexIdx], balance: newCex[cexIdx].balance - amount, usdValue: (newCex[cexIdx].balance - amount) * price };
      const newDex = [...prev.dexBalances];
      const dexIdx = newDex.findIndex((c) => c.symbol === symbol);
      if (dexIdx >= 0) {
        newDex[dexIdx] = { ...newDex[dexIdx], balance: newDex[dexIdx].balance + amount, usdValue: (newDex[dexIdx].balance + amount) * price };
      } else {
        newDex.push({ symbol, name: COIN_NAMES[symbol] ?? symbol, balance: amount, usdValue: amount * price, logo: COIN_LOGOS[symbol] ?? symbol[0], color: COIN_COLORS[symbol] ?? "#888", change24h: 0 });
      }
      const txHash = "0x" + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
      const tx: DexTx = { id: Date.now().toString(), hash: txHash, kind: "deposit", symbol, amount, usdValue: amount * price, from: "Exchange Wallet", to: prev.dexAddress, network: "eth", gasFee: 0, timestamp: Date.now(), status: "completed" };
      const newState = { ...prev, cexBalances: newCex, dexBalances: newDex, dexTxs: [tx, ...prev.dexTxs], ...recalcTotals(newCex, newDex) };
      persist(newState);
      return newState;
    });
  }, []);

  const importDexWallet = useCallback(async (words: string[]): Promise<{ ok: boolean; error?: string }> => {
    const cleaned = words.map((w) => w.trim().toLowerCase()).filter((w) => w.length > 0);
    if (cleaned.length !== 12) return { ok: false, error: "Seed phrase must be exactly 12 words." };
    if (cleaned.some((w) => !/^[a-z]+$/.test(w))) return { ok: false, error: "Words may only contain lowercase letters." };
    if (!isValidMnemonic(cleaned)) return { ok: false, error: "Invalid recovery phrase. Check the words and their order — this is not a valid BIP-39 mnemonic." };
    const address = await deriveAddressFromMnemonic(cleaned);
    setState((prev) => {
      const newState = { ...prev, dexSeedPhrase: cleaned, dexAddress: address, dexCreated: true, seedConfirmed: true, walletImported: true };
      persist(newState);
      return newState;
    });
    return { ok: true };
  }, []);

  const resetDexWallet = useCallback(() => {
    setState((prev) => {
      const newState = { ...prev, dexCreated: false, seedConfirmed: false, dexAddress: "", dexSeedPhrase: [], dexBalances: [], dexTxs: [], connectedDapps: [], walletImported: false, totalDexUsd: 0 };
      persist(newState);
      return newState;
    });
  }, []);

  const sendFromDex = useCallback((symbol: string, amount: number, toAddress: string, network: string): { ok: boolean; error?: string; tx?: DexTx } => {
    let result: { ok: boolean; error?: string; tx?: DexTx } = { ok: false, error: "Unknown error" };
    setState((prev) => {
      const idx = prev.dexBalances.findIndex((c) => c.symbol === symbol);
      if (idx < 0 || prev.dexBalances[idx].balance < amount) {
        result = { ok: false, error: "Insufficient balance." };
        return prev;
      }
      if (!toAddress || toAddress.length < 8) {
        result = { ok: false, error: "Invalid destination address." };
        return prev;
      }
      const price = COIN_PRICES[symbol] ?? 1;
      const newDex = [...prev.dexBalances];
      const newBal = newDex[idx].balance - amount;
      newDex[idx] = { ...newDex[idx], balance: newBal, usdValue: newBal * price };
      const filtered = newDex.filter((c) => c.balance > 0.000001 || c.symbol === symbol);
      const txHash = "0x" + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
      const gasFee = network === "eth" ? 0.0008 : network === "bsc" ? 0.0002 : 0.0001;
      const tx: DexTx = { id: Date.now().toString(), hash: txHash, kind: "send", symbol, amount, usdValue: amount * price, from: prev.dexAddress, to: toAddress, network, gasFee, timestamp: Date.now(), status: "completed" };
      const newState = { ...prev, dexBalances: filtered, dexTxs: [tx, ...prev.dexTxs], ...recalcTotals(prev.cexBalances, filtered) };
      persist(newState);
      result = { ok: true, tx };
      return newState;
    });
    return result;
  }, []);

  const connectDapp = useCallback((dapp: Omit<ConnectedDapp, "connectedAt">) => {
    setState((prev) => {
      if (prev.connectedDapps.find((d) => d.id === dapp.id)) return prev;
      const entry: ConnectedDapp = { ...dapp, connectedAt: Date.now() };
      const newState = { ...prev, connectedDapps: [entry, ...prev.connectedDapps] };
      persist(newState);
      return newState;
    });
  }, []);

  const disconnectDapp = useCallback((id: string) => {
    setState((prev) => {
      const newState = { ...prev, connectedDapps: prev.connectedDapps.filter((d) => d.id !== id) };
      persist(newState);
      return newState;
    });
  }, []);

  return (
    <WalletContext.Provider value={{ ...state, buyCoin, sellCoin, swapCoins, stakeCoins, unstakePosition, createDexWallet, confirmSeed, importDexWallet, resetDexWallet, depositToDex, sendFromDex, connectDapp, disconnectDapp }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
