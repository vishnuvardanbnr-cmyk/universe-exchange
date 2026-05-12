import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useWallet, COIN_PRICES } from "@/context/WalletContext";
import { useLivePrice } from "@/context/LivePriceContext";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useNotifications } from "@/context/NotificationsContext";
import CoinLogo from "@/components/CoinLogo";
import CreateDexWallet from "@/components/CreateDexWallet";
import DeFiWalletDashboard from "@/components/DeFiWalletDashboard";
import { useUserWallet } from "@/context/UserWalletContext";
import type { DepositNetwork, DepositAddress, TxHistoryItem } from "@/context/UserWalletContext";
import * as Clipboard from "expo-clipboard";

type WalletTab = "CEX" | "DEX";

const DEP_COLORS: Record<string, string> = {
  BTC:"#F7931A", ETH:"#627EEA", BNB:"#F0B90B", SOL:"#9945FF", USDT:"#26A17B", USDC:"#2775CA",
  XRP:"#346AA9", ADA:"#0033AD", DOGE:"#C3A634", AVAX:"#E84142", TRX:"#EF0027", LTC:"#BFBBBB",
  MATIC:"#8247E5", LINK:"#2A5ADA", ATOM:"#6F7390", DOT:"#E6007A", UNI:"#FF007A",
  NEAR:"#00C08B", ARB:"#28A0F0", OP:"#FF0420", APT:"#2AA3EF", SUI:"#6FBCF0", INJ:"#00F2FE",
};

const COIN_NAMES_MAP: Record<string, string> = {
  BTC:"Bitcoin", ETH:"Ethereum", BNB:"BNB", SOL:"Solana", XRP:"XRP",
  ADA:"Cardano", DOGE:"Dogecoin", AVAX:"Avalanche", USDT:"Tether",
  USDC:"USD Coin", TRX:"TRON", DOT:"Polkadot", MATIC:"Polygon",
  LINK:"Chainlink", LTC:"Litecoin", ATOM:"Cosmos", UNI:"Uniswap",
  NEAR:"NEAR Protocol", ARB:"Arbitrum", OP:"Optimism",
  APT:"Aptos", SUI:"Sui", INJ:"Injective",
};

const POPULAR_COINS = ["BTC","ETH","USDT","BNB","SOL","XRP"];

const NETWORK_META: Record<string, { arrival: string; confirms: string; minDeposit: string; withdrawFee: string }> = {
  ERC20:     { arrival:"~5 min",  confirms:"12 confirmations",   minDeposit:"0.001 ETH",   withdrawFee:"0.001 ETH" },
  BEP20:     { arrival:"~3 min",  confirms:"15 confirmations",   minDeposit:"0.001 BNB",   withdrawFee:"0.0005 BNB" },
  BTC:       { arrival:"~30 min", confirms:"2 confirmations",    minDeposit:"0.0001 BTC",  withdrawFee:"0.00005 BTC" },
  SOL:       { arrival:"~1 min",  confirms:"1 confirmation",     minDeposit:"0.001 SOL",   withdrawFee:"0.001 SOL" },
  TRC20:     { arrival:"~2 min",  confirms:"19 confirmations",   minDeposit:"1 USDT",      withdrawFee:"1 USDT" },
  RIPPLE:    { arrival:"~3 min",  confirms:"1 confirmation",     minDeposit:"0.01 XRP",    withdrawFee:"0.25 XRP" },
  CARDANO:   { arrival:"~10 min", confirms:"15 confirmations",   minDeposit:"1 ADA",       withdrawFee:"0.5 ADA" },
  AVAX:      { arrival:"~5 min",  confirms:"1 confirmation",     minDeposit:"0.001 AVAX",  withdrawFee:"0.01 AVAX" },
  COSMOS:    { arrival:"~5 min",  confirms:"1 confirmation",     minDeposit:"0.01 ATOM",   withdrawFee:"0.005 ATOM" },
  POLKADOT:  { arrival:"~5 min",  confirms:"1 confirmation",     minDeposit:"0.1 DOT",     withdrawFee:"0.05 DOT" },
  POLYGON:   { arrival:"~3 min",  confirms:"200 confirmations",  minDeposit:"0.1 MATIC",   withdrawFee:"0.1 MATIC" },
  LTC:       { arrival:"~15 min", confirms:"6 confirmations",    minDeposit:"0.001 LTC",   withdrawFee:"0.001 LTC" },
  DOGECOIN:  { arrival:"~10 min", confirms:"40 confirmations",   minDeposit:"1 DOGE",      withdrawFee:"5 DOGE" },
  ARBITRUM:  { arrival:"~3 min",  confirms:"1 confirmation",     minDeposit:"0.001 ARB",   withdrawFee:"0.1 ARB" },
  OPTIMISM:  { arrival:"~3 min",  confirms:"1 confirmation",     minDeposit:"0.001 OP",    withdrawFee:"0.1 OP" },
  NEAR:      { arrival:"~2 min",  confirms:"1 confirmation",     minDeposit:"0.01 NEAR",   withdrawFee:"0.01 NEAR" },
  APTOS:     { arrival:"~2 min",  confirms:"1 confirmation",     minDeposit:"0.001 APT",   withdrawFee:"0.001 APT" },
  SUI:       { arrival:"~2 min",  confirms:"1 confirmation",     minDeposit:"0.001 SUI",   withdrawFee:"0.001 SUI" },
  INJECTIVE: { arrival:"~3 min",  confirms:"1 confirmation",     minDeposit:"0.001 INJ",   withdrawFee:"0.01 INJ" },
  LINK:      { arrival:"~5 min",  confirms:"12 confirmations",   minDeposit:"0.1 LINK",    withdrawFee:"0.5 LINK" },
  UNISWAP:   { arrival:"~5 min",  confirms:"12 confirmations",   minDeposit:"0.1 UNI",     withdrawFee:"0.5 UNI" },
  TRXMAIN:   { arrival:"~2 min",  confirms:"19 confirmations",   minDeposit:"10 TRX",      withdrawFee:"1 TRX" },
};

export default function WalletScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const {
    cexBalances, dexBalances, transactions, totalCexUsd, totalDexUsd,
    dexCreated, dexAddress, dexSeedPhrase, depositToDex,
  } = useWallet();
  const { getPrice, connected } = useLivePrice();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const scrollRef = useRef<ScrollView>(null);
  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));
  const [activeTab, setActiveTab] = useState<WalletTab>("CEX");
  const [assetSearch, setAssetSearch] = useState("");
  const [showSeed, setShowSeed] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferSymbol, setTransferSymbol] = useState("ETH");
  const [hideBalance, setHideBalance] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [depositDefaultCoin, setDepositDefaultCoin] = useState("");
  const [withdrawDefaultCoin, setWithdrawDefaultCoin] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const COIN_COLORS: Record<string, string> = {
    BTC: "#F7931A", ETH: "#627EEA", BNB: "#F0B90B", USDT: "#26A17B", USDC: "#2775CA",
    SOL: "#9945FF", XRP: "#346AA9", ADA: "#0033AD", DOGE: "#C3A634", AVAX: "#E84142",
    TRX: "#EF0027", DOT: "#E6007A", MATIC: "#8247E5", LINK: "#2A5ADA", LTC: "#BFBBBB",
    ATOM: "#6F7390", UNI: "#FF007A", NEAR: "#00C08B", ARB: "#28A0F0", OP: "#FF0420",
    APT: "#2AA3EF", SUI: "#6FBCF0", INJ: "#00F2FE",
  };
  const COIN_NAMES: Record<string, string> = {
    BTC: "Bitcoin", ETH: "Ethereum", BNB: "BNB", SOL: "Solana", XRP: "XRP",
    ADA: "Cardano", DOGE: "Dogecoin", AVAX: "Avalanche", USDT: "Tether",
    USDC: "USD Coin", TRX: "TRON", DOT: "Polkadot", MATIC: "Polygon",
    LINK: "Chainlink", LTC: "Litecoin", ATOM: "Cosmos", UNI: "Uniswap",
    NEAR: "NEAR Protocol", ARB: "Arbitrum", OP: "Optimism",
    APT: "Aptos", SUI: "Sui", INJ: "Injective",
  };

  const {
    balances: userBalances,
    loading: walletLoading,
    tradableCoins,
    fetchBalances,
    getDepositNetworks,
    getDepositAddress,
    submitDepositRequest,
  } = useUserWallet();

  useFocusEffect(useCallback(() => {
    if (user) fetchBalances();
  }, [user, fetchBalances]));

  const MCAP_RANK: Record<string, number> = {
    BTC:1,ETH:2,USDT:3,BNB:4,SOL:5,USDC:6,XRP:7,ADA:8,DOGE:9,AVAX:10,
    TRX:11,DOT:12,MATIC:13,LINK:14,LTC:15,ATOM:16,UNI:17,NEAR:18,ARB:19,OP:20,
    APT:21,SUI:22,INJ:23,
  };

  // CEX: merge DB balances with tradable coins — funded coins always visible even if admin disabled
  const cexSource = (() => {
    const fundedCoins = userBalances.filter((b) => b.available + b.locked > 0).map((b) => b.coin);
    const allToShow = Array.from(new Set([...tradableCoins, ...fundedCoins]));
    return allToShow
      .map((sym) => {
        const dbRow = userBalances.find((b) => b.coin === sym);
        const total = dbRow ? dbRow.available + dbRow.locked : 0;
        const locked = dbRow ? dbRow.locked : 0;
        const lp = getPrice(sym);
        const usdValue = lp > 0 ? total * lp : 0;
        const color = COIN_COLORS[sym] ?? "#848E9C";
        return { symbol: sym, name: COIN_NAMES[sym] ?? sym, balance: total, usdValue, change24h: 0, color, logo: "", locked, price: lp };
      })
      .sort((a, b) => {
        if (a.balance > 0 && b.balance === 0) return -1;
        if (a.balance === 0 && b.balance > 0) return 1;
        if (b.usdValue !== a.usdValue) return b.usdValue - a.usdValue;
        return (MCAP_RANK[a.symbol] ?? 99) - (MCAP_RANK[b.symbol] ?? 99);
      });
  })();

  const liveCexTotal = cexSource.reduce((s, a) => s + a.usdValue, 0);

  // DEX (paper/DeFi) balances
  const liveDexTotal = dexBalances.reduce((sum, coin) => {
    const lp = getPrice(coin.symbol);
    const price = lp > 0 ? lp : (coin.balance > 0 ? coin.usdValue / coin.balance : 0);
    return sum + coin.balance * price;
  }, 0) || totalDexUsd;
  const enrichedDex = dexBalances.map((coin) => {
    const lp = getPrice(coin.symbol);
    if (lp <= 0 || coin.balance <= 0) return coin;
    return { ...coin, usdValue: coin.balance * lp };
  });
  const dexSource = [...enrichedDex].filter((c) => c.balance > 0).sort((a, b) => b.usdValue - a.usdValue);

  const allBalances = activeTab === "CEX" ? cexSource : dexSource;
  const balances = assetSearch.trim()
    ? allBalances.filter(c =>
        c.symbol.toLowerCase().includes(assetSearch.toLowerCase()) ||
        c.name.toLowerCase().includes(assetSearch.toLowerCase())
      )
    : allBalances;

  const totalUsd = activeTab === "CEX" ? liveCexTotal : liveDexTotal;

  const handleTransfer = (symbol: string, amount: number) => {
    const bal = cexBalances.find((c) => c.symbol === symbol);
    if (!bal || bal.balance < amount) {
      Alert.alert("Insufficient Balance", `Not enough ${symbol} in exchange wallet.`);
      return;
    }
    depositToDex(symbol, amount);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Transfer Complete", `${amount} ${symbol} moved to DeFi wallet.`);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topNav, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {user ? (
            <TouchableOpacity onPress={() => router.push("/settings")}>
              <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{(user.displayName ?? "?")[0].toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.push("/auth")} style={[styles.signInBadge, { backgroundColor: colors.primary }]}>
              <Feather name="user" size={13} color={colors.primaryForeground} />
              <Text style={[styles.signInText, { color: colors.primaryForeground }]}>Sign In</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.navTitle, { color: colors.foreground }]}>Wallet</Text>
        </View>
        <View style={styles.navActions}>
          <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.secondary }]} onPress={() => router.push("/(tabs)/notifications")}>
            <Feather name="bell" size={16} color={colors.mutedForeground} />
            {unreadCount > 0 && <View style={[styles.badge, { backgroundColor: "#FF4B4B" }]}><Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : String(unreadCount)}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: colors.secondary }]}
            onPress={() => setShowHistory(true)}
          >
            <Feather name="clock" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(["CEX", "DEX"] as WalletTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabBtn, { borderBottomColor: activeTab === tab ? colors.primary : "transparent" }]}
          >
            <View style={styles.tabInner}>
              <Feather
                name={tab === "CEX" ? "server" : "shield"}
                size={14}
                color={activeTab === tab ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
                {tab === "CEX" ? "Exchange Wallet" : "DeFi Wallet"}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "DEX" && !dexCreated ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <CreateDexWallet />
        </ScrollView>
      ) : activeTab === "DEX" ? (
        <DeFiWalletDashboard />
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Balance Card */}
          <View style={[styles.balanceCard, { backgroundColor: activeTab === "CEX" ? colors.card : colors.secondary, margin: 16, borderRadius: 20 }]}>
            <View style={styles.balanceCardTop}>
              <View>
                <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                  Exchange Balance
                </Text>
                <View style={styles.balanceRow}>
                  {walletLoading ? (
                    <ActivityIndicator color={colors.primary} size="small" style={{ marginTop: 4 }} />
                  ) : (
                    <Text style={[styles.balanceValue, { color: colors.foreground }]}>
                      {hideBalance ? "••••••" : !user ? "$0.00" : `$${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </Text>
                  )}
                  <TouchableOpacity onPress={() => setHideBalance(!hideBalance)} style={{ marginLeft: 8 }}>
                    <Feather name={hideBalance ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                {!hideBalance && !user && (
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 4 }}>
                    Sign in to view your balance
                  </Text>
                )}
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <View style={[styles.walletTypeBadge, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name="server" size={13} color={colors.primary} />
                  <Text style={[styles.walletTypeText, { color: colors.primary }]}>Custodial</Text>
                </View>
                <View style={[styles.liveBadge, { backgroundColor: connected ? "#00C08718" : colors.secondary }]}>
                  <View style={[styles.liveDotSmall, { backgroundColor: connected ? "#00C087" : "#888" }]} />
                  <Text style={[styles.liveBadgeText, { color: connected ? "#00C087" : colors.mutedForeground }]}>
                    {connected ? "Live" : "Loading"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.actionRow}>
              <ActionButton icon="arrow-down-circle" label="Deposit" color={colors.success} onPress={() => setShowDeposit(true)} />
              <ActionButton icon="arrow-up-circle" label="Withdraw" color={colors.primary} onPress={() => setShowWithdraw(true)} />
              <ActionButton icon="send" label="Transfer" color={colors.foreground} onPress={() => setShowTransfer(true)} />
              <ActionButton icon="repeat" label="Convert" color={colors.mutedForeground} onPress={() => Alert.alert("Convert", "Use the Swap tab to convert between assets instantly.")} />
            </View>
          </View>

          {/* P2P Trading Banner */}
          {activeTab === "CEX" && (
            <View style={{ marginHorizontal: 16, marginBottom: 6, borderRadius: 14, overflow: "hidden",
              backgroundColor: "#F0B90B12", borderWidth: 1, borderColor: "#F0B90B30" }}>
              <TouchableOpacity
                onPress={() => router.push("/p2p" as any)}
                activeOpacity={0.85}
                style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 14 }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#F0B90B22", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="users" size={20} color="#F0B90B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>P2P Trading</Text>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Buy & sell crypto peer-to-peer · 0% fee</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ backgroundColor: "#0ECB8118", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#0ECB81" }}>0% FEE</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#F0B90B" />
                </View>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              {`ASSETS · ${assetSearch.trim() ? `${balances.length} result${balances.length !== 1 ? "s" : ""}` : cexSource.filter(c => c.balance > 0).length > 0 ? `${cexSource.filter(c => c.balance > 0).length} funded` : `${cexSource.length} supported`}`}
            </Text>
          </View>

          <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="search" size={15} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                value={assetSearch}
                onChangeText={(t) => { setAssetSearch(t); }}
                placeholder="Search assets…"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {assetSearch.length > 0 && (
                <TouchableOpacity onPress={() => setAssetSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x-circle" size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {walletLoading && userBalances.length === 0 ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : !user ? (
            <View style={styles.emptyState}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <Feather name="user" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sign in to view balance</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Create an account or sign in to deposit funds and start trading.
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/auth")}
                activeOpacity={0.88}
              >
                <Feather name="user" size={14} color={colors.primaryForeground} />
                <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Sign In / Register</Text>
              </TouchableOpacity>
            </View>
          ) : assetSearch.trim() && balances.length === 0 ? (
            <View style={[styles.emptyState, { paddingVertical: 32 }]}>
              <Feather name="search" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground, marginTop: 10 }]}>No results</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No assets match "{assetSearch}"</Text>
            </View>
          ) : (
            <View style={[styles.assetList, { backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 16 }]}>
              {balances.map((coin, index) => {
                const hasBalance = coin.balance > 0;
                const liveP = getPrice(coin.symbol);
                return (
                  <TouchableOpacity
                    key={coin.symbol}
                    activeOpacity={0.65}
                    onPress={() => setSelectedAsset({ ...coin, livePrice: liveP > 0 ? liveP : coin.price ?? 0 })}
                    style={[
                      styles.assetItem,
                      { borderBottomColor: colors.border },
                      index < balances.length - 1 && styles.assetBorder,
                    ]}
                  >
                    <CoinLogo logo={coin.logo} symbol={coin.symbol} color={coin.color} size={44} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={styles.assetTopRow}>
                        <View>
                          <Text style={[styles.assetSymbol, { color: colors.foreground }]}>{coin.symbol}</Text>
                          <Text style={[styles.assetBalance, { color: colors.mutedForeground }]}>{coin.name}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 2 }}>
                          <Text style={[styles.assetUsd, { color: hasBalance ? colors.foreground : colors.mutedForeground }]}>
                            {hideBalance ? "••••" : hasBalance ? `$${coin.usdValue.toFixed(2)}` : "$0.00"}
                          </Text>
                          <Text style={[styles.assetBalance, { color: colors.mutedForeground }]}>
                            {hideBalance
                              ? "•••"
                              : hasBalance
                                ? `${coin.balance.toFixed(coin.balance > 100 ? 4 : 6)} ${coin.symbol}`
                                : `0 ${coin.symbol}`}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={15} color={colors.border} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}


        </ScrollView>
      )}

      {/* Seed phrase modal */}
      <Modal visible={showSeed} animationType="fade" transparent onRequestClose={() => setShowSeed(false)}>
        <View style={styles.overlay}>
          <View style={[styles.seedModal, { backgroundColor: colors.card }]}>
            <View style={[styles.seedModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.seedModalTitle, { color: colors.foreground }]}>Recovery Phrase</Text>
              <TouchableOpacity onPress={() => setShowSeed(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <View style={[styles.seedWarning, { backgroundColor: colors.destructive + "12" }]}>
              <Feather name="alert-triangle" size={14} color={colors.destructive} />
              <Text style={[styles.seedWarningText, { color: colors.destructive }]}>Never share this phrase with anyone — ever.</Text>
            </View>
            <View style={styles.seedGrid}>
              {dexSeedPhrase.map((word, i) => (
                <View key={i} style={[styles.seedChip, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.seedNum, { color: colors.mutedForeground }]}>{i + 1}</Text>
                  <Text style={[styles.seedWordText, { color: colors.foreground }]}>{word}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={[styles.seedCloseBtn, { backgroundColor: colors.primary }]} onPress={() => setShowSeed(false)}>
              <Text style={[styles.seedCloseBtnText, { color: colors.primaryForeground }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Transfer modal */}
      <TransferModal
        visible={showTransfer}
        onClose={() => setShowTransfer(false)}
        onTransfer={handleTransfer}
        cexBalances={cexBalances}
        selected={transferSymbol}
        onSelect={setTransferSymbol}
      />

      {/* Deposit modal */}
      <AssetActionSheet
        asset={selectedAsset}
        colors={colors}
        onClose={() => setSelectedAsset(null)}
        onDeposit={(sym) => { setSelectedAsset(null); setDepositDefaultCoin(sym); setShowDeposit(true); }}
        onWithdraw={(sym) => { setSelectedAsset(null); setWithdrawDefaultCoin(sym); setShowWithdraw(true); }}
        onTrade={(sym) => { setSelectedAsset(null); router.push({ pathname: "/(tabs)/trade", params: { symbol: sym } } as any); }}
        onSwap={() => { setSelectedAsset(null); router.push("/(tabs)/swap" as any); }}
      />

      <DepositModal visible={showDeposit} coins={tradableCoins} defaultCoin={depositDefaultCoin} onClose={() => { setShowDeposit(false); setDepositDefaultCoin(""); }} />

      {/* Withdraw modal */}
      <WithdrawModal visible={showWithdraw} defaultCoin={withdrawDefaultCoin} onClose={() => { setShowWithdraw(false); setWithdrawDefaultCoin(""); }} />

      <TransactionHistoryModal visible={showHistory} onClose={() => setShowHistory(false)} />
    </View>
  );
}

function ActionButton({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.actionBtnCircle, { backgroundColor: color + "18" }]}>
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.actionBtnLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TransferModal({ visible, onClose, onTransfer, cexBalances, selected, onSelect }: {
  visible: boolean;
  onClose: () => void;
  onTransfer: (symbol: string, amount: number) => void;
  cexBalances: any[];
  selected: string;
  onSelect: (s: string) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const selectedBal = cexBalances.find((c) => c.symbol === selected);
  const amt = parseFloat(amounts[selected] ?? "") || 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.transferContainer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.transferHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.transferTitle, { color: colors.foreground }]}>Move to DeFi Wallet</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text style={[styles.transferLabel, { color: colors.mutedForeground }]}>Select Asset</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {cexBalances.filter((c) => c.balance > 0).map((coin) => (
              <TouchableOpacity
                key={coin.symbol}
                onPress={() => onSelect(coin.symbol)}
                style={[
                  styles.assetChip,
                  { backgroundColor: selected === coin.symbol ? colors.primary : colors.secondary,
                    borderColor: selected === coin.symbol ? colors.primary : colors.border },
                ]}
              >
                <View style={[styles.chipDot, { backgroundColor: coin.color }]} />
                <Text style={[styles.assetChipText, { color: selected === coin.symbol ? colors.primaryForeground : colors.foreground }]}>{coin.symbol}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selectedBal && (
            <View style={[styles.amountSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.amountHeader}>
                <Text style={[styles.transferLabel, { color: colors.mutedForeground }]}>Amount</Text>
                <TouchableOpacity onPress={() => setAmounts((p) => ({ ...p, [selected]: selectedBal.balance.toFixed(6) }))}>
                  <Text style={[styles.maxTag, { color: colors.primary }]}>MAX</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.amountRow}>
                <CoinLogo logo={selectedBal.logo} symbol={selectedBal.symbol} color={selectedBal.color} size={36} />
                <View style={{ flex: 1, gap: 2 }}>
                  <TextInput
                    style={[styles.amountInput, { color: colors.foreground }]}
                    placeholder={`0.000000 ${selected}`}
                    placeholderTextColor={colors.mutedForeground}
                    value={amounts[selected] ?? ""}
                    onChangeText={(v) => setAmounts((p) => ({ ...p, [selected]: v }))}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                  <Text style={[styles.amountUsd, { color: colors.mutedForeground }]}>
                    ≈ ${(amt * (COIN_PRICES[selected] ?? 1)).toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={styles.quickBtns}>
                {["25%", "50%", "75%", "100%"].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.quickBtn, { backgroundColor: colors.secondary }]}
                    onPress={() => {
                      const frac = parseInt(p) / 100;
                      setAmounts((prev) => ({ ...prev, [selected]: (selectedBal.balance * frac).toFixed(6) }));
                    }}
                  >
                    <Text style={[styles.quickBtnText, { color: colors.mutedForeground }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.availText, { color: colors.mutedForeground }]}>
                Available: {selectedBal.balance.toFixed(6)} {selected}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              const a = parseFloat(amounts[selected] ?? "") || 0;
              if (a > 0) onTransfer(selected, a);
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.confirmBtnText, { color: colors.primaryForeground }]}>Confirm Transfer</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Shared: Coin selection list ──────────────────────────────────────────
function CoinSelectList({ coins, onSelect }: { coins: string[]; onSelect: (c: string) => void }) {
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const q = search.trim().toUpperCase();
  const filtered = q
    ? coins.filter(c => c.includes(q) || (COIN_NAMES_MAP[c] ?? "").toLowerCase().includes(q.toLowerCase()))
    : coins;
  const popular = POPULAR_COINS.filter(c => coins.includes(c));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {/* Search */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, margin: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.secondary, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
        <Feather name="search" size={15} color={colors.mutedForeground} />
        <TextInput
          style={{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground }}
          placeholder="Search coin name or symbol…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="characters"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Popular */}
      {!search && popular.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.8, marginBottom: 10 }}>POPULAR</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {popular.map(sym => (
              <TouchableOpacity
                key={sym}
                onPress={() => onSelect(sym)}
                activeOpacity={0.75}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.card, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: (DEP_COLORS[sym] ?? "#848E9C") + "30", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 8, fontFamily: "Inter_700Bold", color: DEP_COLORS[sym] ?? "#848E9C" }}>{sym.slice(0, 3)}</Text>
                </View>
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{sym}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Divider */}
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 8 }} />

      {/* All coins */}
      <View style={{ paddingHorizontal: 16, marginBottom: 6 }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.8 }}>{search ? "RESULTS" : "ALL COINS"}</Text>
      </View>
      <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 16, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: "center", gap: 10 }}>
            <Feather name="search" size={32} color={colors.border} />
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>No coins found</Text>
          </View>
        ) : filtered.map((sym, i) => (
          <TouchableOpacity
            key={sym}
            onPress={() => onSelect(sym)}
            activeOpacity={0.75}
            style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 }, i < filtered.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
          >
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: (DEP_COLORS[sym] ?? "#848E9C") + "22", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: DEP_COLORS[sym] ?? "#848E9C" }}>{sym.slice(0, 4)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{sym}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{COIN_NAMES_MAP[sym] ?? sym}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Shared: Network selection list ───────────────────────────────────────
function NetworkSelectList({ networks, coin, mode, onSelect }: {
  networks: DepositNetwork[];
  coin: string;
  mode: "deposit" | "withdraw";
  onSelect: (n: DepositNetwork) => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Warning */}
      <View style={{ flexDirection: "row", gap: 10, margin: 16, padding: 14, backgroundColor: "#F0B90B12", borderRadius: 12 }}>
        <Feather name="alert-triangle" size={15} color="#F0B90B" style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#F0B90B", lineHeight: 18 }}>
          Ensure you select the correct network. Sending to the wrong network may result in permanent loss of funds.
        </Text>
      </View>

      {networks.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}>
          <Feather name="alert-circle" size={44} color={colors.border} />
          <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Not supported yet</Text>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", paddingHorizontal: 32 }}>
            {coin} {mode} is not yet available. Please contact support.
          </Text>
        </View>
      ) : (
        <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 16, overflow: "hidden" }}>
          {networks.map((n, i) => {
            const meta = NETWORK_META[n.network];
            return (
              <TouchableOpacity
                key={n.network}
                onPress={() => onSelect(n)}
                activeOpacity={0.75}
                style={[{ padding: 16, gap: 10 }, i < networks.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>{n.label ?? n.network}</Text>
                      <View style={{ backgroundColor: colors.secondary, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>{n.network}</Text>
                      </View>
                      {n.memoRequired && (
                        <View style={{ backgroundColor: "#F0B90B18", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#F0B90B" }}>Memo</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </View>
                {meta && (
                  <View style={{ flexDirection: "row", gap: 20 }}>
                    <View>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Expected Arrival</Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{meta.arrival}</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                        {mode === "deposit" ? "Min. Deposit" : "Network Fee"}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                        {mode === "deposit" ? meta.minDeposit : meta.withdrawFee}
                      </Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Confirmations</Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{meta.confirms}</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// ─── AssetActionSheet ───────────────────────────────────────────────────────
function AssetActionSheet({ asset, colors, onClose, onDeposit, onWithdraw, onTrade, onSwap }: {
  asset: any; colors: any; onClose: () => void;
  onDeposit: (sym: string) => void;
  onWithdraw: (sym: string) => void;
  onTrade: (sym: string) => void;
  onSwap: () => void;
}) {
  const { getPrice, getTicker } = useLivePrice();
  const { checkDeposits } = useUserWallet();
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ found: number; credited: number } | null>(null);

  const handleCheckDeposit = async () => {
    if (!asset) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const result = await checkDeposits(asset.symbol);
      setCheckResult({ found: result.found, credited: result.credited });
      if (result.credited > 0) {
        Alert.alert(
          "Deposit Credited! 🎉",
          `${result.credited} deposit(s) confirmed and added to your ${asset.symbol} balance.`,
          [{ text: "Great!", style: "default" }]
        );
      } else if (result.found > 0) {
        Alert.alert(
          "Deposit Detected",
          `${result.found} deposit(s) found and awaiting confirmations. Check again shortly.`,
          [{ text: "OK", style: "default" }]
        );
      } else {
        Alert.alert(
          "No New Deposits",
          `No pending ${asset.symbol} deposits found on-chain. If you just sent a transaction, please wait a few minutes and try again.`,
          [{ text: "OK", style: "default" }]
        );
      }
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to check deposits");
    } finally {
      setChecking(false);
    }
  };

  if (!asset) return null;
  const liveP = getPrice(asset.symbol);
  const price = liveP > 0 ? liveP : asset.livePrice ?? 0;
  const ticker = getTicker(asset.symbol);
  const change = ticker?.change24h ?? asset.change24h ?? 0;
  const isPos = change >= 0;
  const hasBalance = asset.balance > 0;
  const usdVal = hasBalance ? asset.balance * (price > 0 ? price : 1) : 0;
  const isStable = asset.symbol === "USDT" || asset.symbol === "USDC";
  const coinColor = DEP_COLORS[asset.symbol] ?? asset.color ?? "#848E9C";

  const actions = [
    { icon: "trending-up", label: "Trade",    sublabel: "Spot market",   color: "#F0B90B", onPress: () => onTrade(asset.symbol) },
    { icon: "repeat",      label: "Swap",     sublabel: "Instant swap",  color: "#2775CA", onPress: onSwap },
    { icon: "arrow-down-circle", label: "Deposit",  sublabel: "Add funds",     color: "#0ECB81", onPress: () => onDeposit(asset.symbol) },
    { icon: "arrow-up-circle",   label: "Withdraw", sublabel: "Send to wallet", color: "#F6465D", onPress: () => onWithdraw(asset.symbol) },
  ];

  return (
    <Modal visible={!!asset} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#00000070" }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          {/* Handle bar */}
          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          {/* Coin header */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, gap: 14,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: asset.color + "22",
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: asset.color }}>{asset.logo || asset.symbol[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground }}>{asset.symbol}</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{asset.name}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 3 }}>
              <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                {price > 0 ? `$${price.toLocaleString("en-US", { minimumFractionDigits: price > 1 ? 2 : 4 })}` : "—"}
              </Text>
              {!isStable && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3,
                  backgroundColor: isPos ? "#0ECB8118" : "#F6465D18", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                  <Feather name={isPos ? "arrow-up-right" : "arrow-down-right"} size={11} color={isPos ? "#0ECB81" : "#F6465D"} />
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: isPos ? "#0ECB81" : "#F6465D" }}>
                    {isPos ? "+" : ""}{change.toFixed(2)}%
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Balance row */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingHorizontal: 20, paddingVertical: 14,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.4 }}>YOUR BALANCE</Text>
              <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: hasBalance ? colors.foreground : colors.mutedForeground }}>
                {hasBalance ? `${asset.balance.toFixed(asset.balance > 100 ? 4 : 6)} ${asset.symbol}` : `0 ${asset.symbol}`}
              </Text>
              {hasBalance && (
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                  ≈ ${usdVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              )}
            </View>
            {hasBalance && (
              <View style={{ backgroundColor: "#0ECB8118", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" }}>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#0ECB81" }}>FUNDED</Text>
              </View>
            )}
          </View>

          {/* Action grid */}
          <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 16, gap: 10 }}>
            {actions.map(a => (
              <TouchableOpacity key={a.label} onPress={a.onPress} activeOpacity={0.75}
                style={{ flex: 1, alignItems: "center", gap: 8, backgroundColor: colors.secondary,
                  borderRadius: 16, paddingVertical: 16, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ width: 38, height: 38, borderRadius: 19,
                  backgroundColor: a.color + "18", alignItems: "center", justifyContent: "center" }}>
                  <Feather name={a.icon as any} size={17} color={a.color} />
                </View>
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>{a.label}</Text>
                <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }}>{a.sublabel}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Check Deposit button */}
          <TouchableOpacity
            onPress={handleCheckDeposit}
            disabled={checking}
            activeOpacity={0.8}
            style={{
              marginHorizontal: 16, marginBottom: 10,
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
              paddingVertical: 15, borderRadius: 14,
              backgroundColor: coinColor + "15",
              borderWidth: 1, borderColor: coinColor + "40",
            }}
          >
            {checking ? (
              <>
                <ActivityIndicator size="small" color={coinColor} />
                <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: coinColor }}>Scanning blockchain…</Text>
              </>
            ) : (
              <>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: coinColor + "20", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="refresh-cw" size={14} color={coinColor} />
                </View>
                <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: coinColor }}>Check {asset.symbol} Deposit</Text>
                {checkResult && checkResult.credited > 0 && (
                  <View style={{ backgroundColor: "#0ECB8120", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#0ECB81" }}>+{checkResult.credited} credited</Text>
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>

          {/* Close button */}
          <TouchableOpacity onPress={onClose} activeOpacity={0.8}
            style={{ marginHorizontal: 16, marginBottom: 32, padding: 15, borderRadius: 14,
              backgroundColor: colors.secondary, alignItems: "center",
              borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── TransactionHistoryModal ────────────────────────────────────────────────
const TX_PAGE_SIZE = 20;

function txStatusColor(status: string, muted: string) {
  if (["credited","approved","released","confirmed"].includes(status)) return "#0ECB81";
  if (["pending","confirming","detected"].includes(status)) return "#F0B90B";
  if (["rejected","failed","cancelled"].includes(status)) return "#F6465D";
  return muted;
}
function txStatusLabel(status: string) {
  const m: Record<string,string> = {
    credited:"Credited", approved:"Approved", released:"Completed",
    pending:"Pending", confirming:"Confirming", detected:"Detected",
    rejected:"Rejected", failed:"Failed", cancelled:"Cancelled", confirmed:"Confirmed",
  };
  return m[status] ?? status;
}
function txTypeIcon(source: TxHistoryItem["source"]) {
  return source === "withdrawal"
    ? { icon: "arrow-up-circle" as const, color: "#F6465D" }
    : { icon: "arrow-down-circle" as const, color: "#0ECB81" };
}
function txTypeLabel(source: TxHistoryItem["source"]) {
  if (source === "withdrawal") return "Withdrawal";
  if (source === "on_chain") return "On-chain Deposit";
  return "Deposit Request";
}
function txFormatDate(s: string) {
  const d = new Date(s);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    "  " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}

function TransactionHistoryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { fetchTransactionHistory } = useUserWallet();
  const { user } = useAuth();

  const [txList, setTxList]         = useState<TxHistoryItem[]>([]);
  const [total, setTotal]           = useState(0);
  const [hasMore, setHasMore]       = useState(false);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter]         = useState<"all" | "deposit" | "withdraw">("all");

  // Reset + load page 1 whenever the modal opens or filter changes
  useEffect(() => {
    if (!visible || !user) return;
    setTxList([]);
    setPage(1);
    setHasMore(false);
    setLoading(true);
    fetchTransactionHistory({ page: 1, pageSize: TX_PAGE_SIZE, source: filter }).then(({ items, hasMore: hm, total: t }) => {
      setTxList(items);
      setHasMore(hm);
      setTotal(t);
      setLoading(false);
    });
  }, [visible, user, filter]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const { items, hasMore: hm } = await fetchTransactionHistory({ page: nextPage, pageSize: TX_PAGE_SIZE, source: filter });
    setTxList((prev) => [...prev, ...items]);
    setPage(nextPage);
    setHasMore(hm);
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, filter, fetchTransactionHistory]);

  const filters: { key: typeof filter; label: string }[] = [
    { key: "all",      label: "All"          },
    { key: "deposit",  label: "Deposits"     },
    { key: "withdraw", label: "Withdrawals"  },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: insets.bottom }}>

        {/* Header */}
        <View style={[styles.transferHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}
          >
            <Feather name="x" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text style={[styles.transferTitle, { color: colors.foreground }]}>Transaction History</Text>
            {total > 0 && !loading && (
              <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                {txList.length} of {total} record{total !== 1 ? "s" : ""}
              </Text>
            )}
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Filter pills */}
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.75}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                backgroundColor: filter === f.key ? colors.primary : colors.secondary,
                borderWidth: 1, borderColor: filter === f.key ? colors.primary : colors.border,
              }}
            >
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: filter === f.key ? colors.primaryForeground : colors.mutedForeground }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Body */}
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>Loading history…</Text>
          </View>
        ) : !user ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 }}>
            <Feather name="user" size={44} color={colors.border} />
            <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Sign in required</Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center" }}>Please sign in to view your transaction history.</Text>
          </View>
        ) : txList.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}>
              <Feather name="inbox" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>No transactions yet</Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center" }}>
              Your deposits and withdrawals will appear here.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Transaction list card */}
            <View style={{ backgroundColor: colors.card, borderRadius: 18, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
              {txList.map((tx, i) => {
                const { icon, color } = txTypeIcon(tx.source);
                const coinColor = DEP_COLORS[tx.coin] ?? "#848E9C";
                const sc = txStatusColor(tx.status, colors.mutedForeground);
                return (
                  <View
                    key={`${tx.source}-${tx.id}-${i}`}
                    style={[
                      { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
                      i < txList.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                    ]}
                  >
                    {/* Direction icon */}
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color + "18", alignItems: "center", justifyContent: "center" }}>
                      <Feather name={icon} size={20} color={color} />
                    </View>

                    {/* Left: type + date + network */}
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{txTypeLabel(tx.source)}</Text>
                        <View style={{ backgroundColor: coinColor + "18", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: coinColor }}>{tx.coin}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                        {txFormatDate(tx.created_at)}
                      </Text>
                      {!!tx.network && (
                        <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                          {tx.network} network
                        </Text>
                      )}
                    </View>

                    {/* Right: amount + status badge */}
                    <View style={{ alignItems: "flex-end", gap: 5 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: tx.source === "withdrawal" ? "#F6465D" : "#0ECB81" }}>
                        {tx.source === "withdrawal" ? "−" : "+"}
                        {tx.amount != null
                          ? tx.amount.toFixed(tx.amount < 0.001 ? 8 : 6)
                          : "—"}{" "}
                        {tx.coin}
                      </Text>
                      <View style={{ backgroundColor: sc + "20", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: sc }}>
                          {txStatusLabel(tx.status)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Pagination footer */}
            {hasMore && (
              <TouchableOpacity
                onPress={loadMore}
                disabled={loadingMore}
                activeOpacity={0.75}
                style={{
                  marginTop: 16, height: 48, borderRadius: 14,
                  backgroundColor: colors.secondary,
                  borderWidth: 1, borderColor: colors.border,
                  alignItems: "center", justifyContent: "center",
                  flexDirection: "row", gap: 10,
                }}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Feather name="chevrons-down" size={16} color={colors.primary} />
                )}
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.primary }}>
                  {loadingMore ? "Loading…" : `Load more  ·  ${total - txList.length} remaining`}
                </Text>
              </TouchableOpacity>
            )}

            {/* End-of-list indicator when everything is loaded */}
            {!hasMore && txList.length > TX_PAGE_SIZE && (
              <View style={{ alignItems: "center", paddingTop: 20, gap: 4 }}>
                <View style={{ width: 36, height: 1, backgroundColor: colors.border }} />
                <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginTop: 8 }}>
                  All {total} transaction{total !== 1 ? "s" : ""} loaded
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── DepositModal ──────────────────────────────────────────────────────────
function DepositModal({ visible, coins, onClose, defaultCoin }: { visible: boolean; coins: string[]; onClose: () => void; defaultCoin?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getDepositNetworks, getDepositAddress } = useUserWallet();

  const [step, setStep] = useState<"coin" | "network" | "address">("coin");
  const [selectedCoin, setSelectedCoin] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<DepositNetwork | null>(null);
  const [networks, setNetworks] = useState<DepositNetwork[]>([]);
  const [address, setAddress] = useState<DepositAddress | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);

  const handleClose = () => {
    setStep("coin"); setSelectedCoin(""); setSelectedNetwork(null);
    setNetworks([]); setAddress(null); onClose();
  };

  const fetchAddress = async (coin: string, net: DepositNetwork) => {
    setLoading(true);
    const addr = await getDepositAddress(coin, net.network);
    setAddress(addr);
    setLoading(false);
    setStep("address");
  };

  const handleSelectCoin = async (coin: string) => {
    setSelectedCoin(coin);
    setLoading(true);
    setStep("network");
    const nets = await getDepositNetworks(coin);
    setNetworks(nets);
    if (nets.length === 1) {
      setSelectedNetwork(nets[0]);
      await fetchAddress(coin, nets[0]);
    } else {
      setLoading(false);
    }
  };

  const handleSelectNetwork = async (n: DepositNetwork) => {
    setSelectedNetwork(n);
    await fetchAddress(selectedCoin, n);
  };

  useEffect(() => {
    if (visible && defaultCoin) {
      handleSelectCoin(defaultCoin);
    }
  }, [visible, defaultCoin]);

  const handleBack = () => {
    if (step === "address") { setStep(networks.length === 1 ? "coin" : "network"); }
    else if (step === "network") setStep("coin");
    else handleClose();
  };

  const coinColor = DEP_COLORS[selectedCoin] ?? "#848E9C";
  const netMeta = selectedNetwork ? NETWORK_META[selectedNetwork.network] : null;

  const copyAddr = async () => {
    if (!address?.address) return;
    await Clipboard.setStringAsync(address.address);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2500);
  };

  const copyMemo = async () => {
    if (!address?.memo) return;
    await Clipboard.setStringAsync(address.memo);
    Haptics.selectionAsync();
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 2500);
  };

  const stepTitle = step === "coin" ? "Deposit Crypto" : step === "network" ? `Select Network` : `Deposit ${selectedCoin}`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleBack}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>

        {/* Header */}
        <View style={[styles.transferHeader, { borderBottomColor: colors.border, paddingTop: 8 }]}>
          <TouchableOpacity onPress={handleBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}>
            <Feather name={step === "coin" ? "x" : "arrow-left"} size={18} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text style={[styles.transferTitle, { color: colors.foreground }]}>{stepTitle}</Text>
            {step !== "coin" && selectedCoin ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: coinColor }} />
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>{COIN_NAMES_MAP[selectedCoin] ?? selectedCoin}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Step indicators */}
        {step !== "coin" && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, backgroundColor: colors.background }}>
            {(["coin", "network", "address"] as const).map((s, i) => {
              const done = (s === "coin" && (step === "network" || step === "address")) || (s === "network" && step === "address");
              const active = s === step;
              return (
                <React.Fragment key={s}>
                  {i > 0 && <View style={{ width: 24, height: 1.5, backgroundColor: done ? coinColor : colors.border }} />}
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: done ? coinColor : active ? coinColor + "25" : colors.secondary, borderWidth: active ? 2 : 0, borderColor: coinColor, alignItems: "center", justifyContent: "center" }}>
                    {done
                      ? <Feather name="check" size={12} color="#000" />
                      : <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: active ? coinColor : colors.mutedForeground }}>{i + 1}</Text>
                    }
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        )}

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 20 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: coinColor + "18", alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator size="large" color={coinColor} />
            </View>
            <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Generating address…</Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Creating your unique {selectedCoin} address</Text>
            </View>
          </View>
        ) : step === "coin" ? (
          <CoinSelectList coins={coins} onSelect={handleSelectCoin} />
        ) : step === "network" ? (
          <NetworkSelectList networks={networks} coin={selectedCoin} mode="deposit" onSelect={handleSelectNetwork} />
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Coin + Network banner */}
            <View style={{ backgroundColor: coinColor + "10", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: coinColor + "30", paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: coinColor + "22", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: coinColor }}>{selectedCoin.slice(0,3)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground }}>{selectedCoin} Deposit</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{COIN_NAMES_MAP[selectedCoin]} · {selectedNetwork?.label ?? selectedNetwork?.network}</Text>
              </View>
              <View style={{ backgroundColor: "#0ECB8115", borderWidth: 1, borderColor: "#0ECB8130", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#0ECB81" }} />
                <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#0ECB81" }}>UNIQUE</Text>
              </View>
            </View>

            {/* QR Code card */}
            <View style={{ alignItems: "center", paddingVertical: 28, paddingHorizontal: 24 }}>
              <View style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 24,
                padding: 20,
                alignItems: "center",
                gap: 0,
                shadowColor: coinColor,
                shadowOpacity: 0.25,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 6 },
                elevation: 8,
              }}>
                {address?.address ? (
                  <QRCode value={address.address} size={200} color="#000" backgroundColor="#fff" />
                ) : (
                  <View style={{ width: 200, height: 200, alignItems: "center", justifyContent: "center" }}>
                    <Feather name="alert-circle" size={40} color="#999" />
                  </View>
                )}
                {/* Network tag at bottom of QR */}
                <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: coinColor + "15", paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: coinColor }} />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: coinColor, letterSpacing: 0.2 }}>
                    {selectedNetwork?.label ?? selectedNetwork?.network}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ paddingHorizontal: 20, gap: 14 }}>
              {/* Warning */}
              <View style={{ backgroundColor: "#F0B90B0E", borderRadius: 14, padding: 14, flexDirection: "row", gap: 10, borderWidth: 1, borderColor: "#F0B90B25" }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#F0B90B18", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Feather name="alert-triangle" size={14} color="#F0B90B" />
                </View>
                <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#D4A017", lineHeight: 19 }}>
                  Only send{" "}
                  <Text style={{ fontFamily: "Inter_700Bold", color: "#F0B90B" }}>{selectedCoin}</Text>
                  {" "}on the{" "}
                  <Text style={{ fontFamily: "Inter_700Bold", color: "#F0B90B" }}>{selectedNetwork?.label ?? selectedNetwork?.network}</Text>
                  {" "}network. Sending another asset or using the wrong network will result in{" "}
                  <Text style={{ fontFamily: "Inter_700Bold" }}>permanent loss of funds.</Text>
                </Text>
              </View>

              {/* Address card */}
              <View style={{ backgroundColor: colors.card, borderRadius: 18, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
                <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 1 }}>DEPOSIT ADDRESS</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#0ECB8112", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Feather name="shield" size={10} color="#0ECB81" />
                    <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#0ECB81" }}>Unique to you</Text>
                  </View>
                </View>
                <View style={{ padding: 16, gap: 10 }}>
                  <Text
                    style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 22, letterSpacing: 0.3 }}
                    selectable
                  >
                    {address?.address ?? "—"}
                  </Text>
                  <TouchableOpacity
                    onPress={copyAddr}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                      backgroundColor: copiedAddr ? "#0ECB8118" : colors.secondary,
                      borderRadius: 12, paddingVertical: 12,
                      borderWidth: 1, borderColor: copiedAddr ? "#0ECB8140" : colors.border,
                    }}
                  >
                    <Feather name={copiedAddr ? "check" : "copy"} size={15} color={copiedAddr ? "#0ECB81" : colors.primary} />
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: copiedAddr ? "#0ECB81" : colors.primary }}>
                      {copiedAddr ? "Copied!" : "Copy Address"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Memo card */}
              {address?.memo ? (
                <View style={{ backgroundColor: colors.card, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "#FF4B4B35" }}>
                  <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#FF4B4B20", backgroundColor: "#FF4B4B08" }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 1 }}>MEMO / TAG</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FF4B4B15", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#FF4B4B" }} />
                      <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#FF4B4B" }}>REQUIRED</Text>
                    </View>
                  </View>
                  <View style={{ padding: 16, gap: 10 }}>
                    <View style={{ backgroundColor: "#FF4B4B08", borderRadius: 12, padding: 14, alignItems: "center" }}>
                      <Text style={{ fontSize: 28, fontFamily: "Inter_700Bold", color: "#F0B90B", letterSpacing: 4 }} selectable>{address.memo}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={copyMemo}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                        backgroundColor: copiedMemo ? "#0ECB8118" : "#FF4B4B10",
                        borderRadius: 12, paddingVertical: 12,
                        borderWidth: 1, borderColor: copiedMemo ? "#0ECB8140" : "#FF4B4B30",
                      }}
                    >
                      <Feather name={copiedMemo ? "check" : "copy"} size={15} color={copiedMemo ? "#0ECB81" : "#FF4B4B"} />
                      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: copiedMemo ? "#0ECB81" : "#FF4B4B" }}>
                        {copiedMemo ? "Copied!" : "Copy Memo"}
                      </Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: "row", gap: 8, backgroundColor: "#FF4B4B0A", borderRadius: 10, padding: 10 }}>
                      <Feather name="alert-circle" size={13} color="#FF4B4B" style={{ marginTop: 1 }} />
                      <Text style={{ flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: "#FF4B4B", lineHeight: 17 }}>
                        You must include this memo with your deposit. Transactions without the correct memo cannot be recovered.
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Deposit info pills */}
              {netMeta && (
                <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 1, marginBottom: 12 }}>DEPOSIT DETAILS</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1, backgroundColor: colors.secondary, borderRadius: 12, padding: 12, alignItems: "center", gap: 5 }}>
                      <Feather name="clock" size={16} color={coinColor} />
                      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{netMeta.arrival}</Text>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Arrival</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: colors.secondary, borderRadius: 12, padding: 12, alignItems: "center", gap: 5 }}>
                      <Feather name="check-circle" size={16} color="#0ECB81" />
                      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{netMeta.confirms.split(" ")[0]}</Text>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Confirms</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: colors.secondary, borderRadius: 12, padding: 12, alignItems: "center", gap: 5 }}>
                      <Feather name="arrow-down" size={16} color="#628EEA" />
                      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{netMeta.minDeposit.split(" ")[0]}</Text>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Min. Deposit</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Action buttons */}
              <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, backgroundColor: colors.secondary, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}
                  onPress={() => address?.address && Share.share({ message: `My ${selectedCoin} deposit address (${selectedNetwork?.label ?? selectedNetwork?.network}):\n${address.address}${address.memo ? `\nMemo: ${address.memo}` : ""}` })}
                  activeOpacity={0.8}
                >
                  <Feather name="share-2" size={16} color={colors.foreground} />
                  <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, backgroundColor: coinColor, borderRadius: 16 }}
                  onPress={handleClose}
                  activeOpacity={0.85}
                >
                  <Feather name="check" size={16} color="#000" />
                  <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" }}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── WithdrawModal ─────────────────────────────────────────────────────────
function WithdrawModal({ visible, onClose, defaultCoin }: { visible: boolean; onClose: () => void; defaultCoin?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getPrice } = useLivePrice();
  const { balances: userBalances, submitWithdrawal, tradableCoins, getDepositNetworks } = useUserWallet();
  const { user, verifyTwoFactorCode, consumeBackupCode } = useAuth();
  const { t } = useI18n();

  const [step, setStep] = useState<"coin" | "network" | "form" | "twofa">("coin");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaError, setTwoFaError] = useState("");
  const [selectedCoin, setSelectedCoin] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<DepositNetwork | null>(null);
  const [networks, setNetworks] = useState<DepositNetwork[]>([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const displayCoins = tradableCoins.length > 0 ? tradableCoins : ["BTC","ETH","USDT","USDC","SOL","BNB"];
  const coinBal = userBalances.find(c => c.coin === selectedCoin);
  const available = coinBal?.available ?? 0;
  const numAmt = parseFloat(amount) || 0;
  const liveP = getPrice(selectedCoin);
  const price = liveP > 0 ? liveP : (COIN_PRICES[selectedCoin] ?? 1);
  const usdValue = numAmt * price;
  const netMeta = selectedNetwork ? NETWORK_META[selectedNetwork.network] : null;
  const coinColor = DEP_COLORS[selectedCoin] ?? "#848E9C";

  const handleClose = () => {
    setStep("coin"); setSelectedCoin(""); setSelectedNetwork(null);
    setNetworks([]); setToAddress(""); setAmount("");
    setTwoFaCode(""); setTwoFaError("");
    onClose();
  };

  const handleSelectCoin = async (coin: string) => {
    setSelectedCoin(coin);
    setNetworksLoading(true);
    setStep("network");
    const nets = await getDepositNetworks(coin);
    setNetworks(nets);
    setNetworksLoading(false);
    if (nets.length === 1) {
      setSelectedNetwork(nets[0]);
      setStep("form");
    }
  };

  useEffect(() => {
    if (visible && defaultCoin) {
      handleSelectCoin(defaultCoin);
    }
  }, [visible, defaultCoin]);

  const handleBack = () => {
    if (step === "twofa") { setStep("form"); setTwoFaCode(""); setTwoFaError(""); }
    else if (step === "form") setStep(networks.length === 1 ? "coin" : "network");
    else if (step === "network") setStep("coin");
    else handleClose();
  };

  const handleSelectNetwork = (n: DepositNetwork) => {
    setSelectedNetwork(n);
    setStep("form");
  };

  const performWithdraw = async () => {
    setSubmitting(true);
    try {
      await submitWithdrawal({ coin: selectedCoin, network: selectedNetwork?.network ?? "Native", amount: numAmt, toAddress: toAddress.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Submitted", `Your withdrawal of ${numAmt} ${selectedCoin} has been submitted and will be processed within 24 hours.`);
      handleClose();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to submit withdrawal.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!toAddress.trim()) { Alert.alert("Invalid Address", "Please enter a destination address."); return; }
    if (numAmt <= 0) { Alert.alert("Invalid Amount", "Please enter a valid amount."); return; }
    if (available < numAmt) { Alert.alert("Insufficient Balance", `You only have ${available.toFixed(8)} ${selectedCoin} available.`); return; }

    const confirmAndSubmit = () => {
      Alert.alert(
        "Confirm Withdrawal",
        `Coin: ${selectedCoin}\nNetwork: ${selectedNetwork?.label ?? selectedNetwork?.network}\nAmount: ${numAmt} ${selectedCoin}\nTo: ${toAddress.length > 30 ? toAddress.slice(0, 16) + "…" + toAddress.slice(-12) : toAddress}`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Confirm", style: "destructive", onPress: performWithdraw },
        ]
      );
    };

    if (user?.twoFactorEnabled) {
      setTwoFaCode("");
      setTwoFaError("");
      setStep("twofa");
      return;
    }
    confirmAndSubmit();
  };

  const handleTwoFaSubmit = async () => {
    const raw = twoFaCode.trim();
    if (!raw) { setTwoFaError("Enter your 6-digit code or a backup code."); return; }
    const cleaned = raw.replace(/\s/g, "");
    if (/^\d{6}$/.test(cleaned) && verifyTwoFactorCode(cleaned)) {
      setTwoFaError("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await performWithdraw();
      return;
    }
    const usedBackup = await consumeBackupCode(raw);
    if (usedBackup) {
      setTwoFaError("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await performWithdraw();
      return;
    }
    setTwoFaError("Invalid code. Try again or use a backup code.");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const title = step === "coin" ? t("withdraw.title") : step === "twofa" ? t("withdraw.twofa.title") : t("withdraw.titleCoin", { coin: selectedCoin });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleBack}>
      <View style={[styles.transferContainer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.transferHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleBack}>
            <Feather name={step === "coin" ? "x" : "arrow-left"} size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.transferTitle, { color: colors.foreground }]}>{title}</Text>
          <View style={{ width: 22 }} />
        </View>

        {networksLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Loading networks…</Text>
          </View>
        ) : step === "coin" ? (
          <CoinSelectList coins={displayCoins} onSelect={handleSelectCoin} />
        ) : step === "network" ? (
          <NetworkSelectList networks={networks} coin={selectedCoin} mode="withdraw" onSelect={handleSelectNetwork} />
        ) : step === "twofa" ? (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: "center", marginTop: 12, marginBottom: 4 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Feather name="shield" size={28} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center" }}>
                {t("withdraw.twofa.heading")}
              </Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", marginTop: 8, lineHeight: 18, paddingHorizontal: 12 }}>
                {t("withdraw.twofa.subtitle", { amount: numAmt, coin: selectedCoin })}
              </Text>
            </View>

            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10 }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.8 }}>{t("withdraw.twofa.field")}</Text>
              <TextInput
                style={{ backgroundColor: colors.secondary, borderRadius: 12, padding: 14, fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center", letterSpacing: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: twoFaError ? "#F6465D" : colors.border }}
                placeholder="000000"
                placeholderTextColor={colors.mutedForeground}
                value={twoFaCode}
                onChangeText={(t) => { setTwoFaCode(t); setTwoFaError(""); }}
                keyboardType="number-pad"
                maxLength={20}
                autoFocus
              />
              {twoFaError ? (
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: "#F6465D" }}>{twoFaError}</Text>
              ) : (
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                  {t("withdraw.twofa.help")}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: submitting ? colors.border : colors.primary, marginTop: 4 }]}
              onPress={handleTwoFaSubmit}
              activeOpacity={0.85}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                : <Text style={[styles.confirmBtnText, { color: colors.primaryForeground }]}>{t("withdraw.twofa.button")}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Coin + balance summary */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: coinColor + "22", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: coinColor }}>{selectedCoin.slice(0,3)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>{selectedCoin}</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{COIN_NAMES_MAP[selectedCoin] ?? selectedCoin}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>{available.toFixed(6)}</Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Available</Text>
              </View>
            </View>

            {/* Network (tappable) */}
            <TouchableOpacity
              onPress={() => setStep("network")}
              style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              activeOpacity={0.7}
            >
              <View>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.8, marginBottom: 4 }}>NETWORK</Text>
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>{selectedNetwork?.label ?? selectedNetwork?.network}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary }}>Change</Text>
                <Feather name="chevron-right" size={14} color={colors.primary} />
              </View>
            </TouchableOpacity>

            {/* Address input */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10 }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.8 }}>WITHDRAWAL ADDRESS</Text>
              <View style={{ backgroundColor: colors.secondary, borderRadius: 12, flexDirection: "row", alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
                <TextInput
                  style={{ flex: 1, padding: 14, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground }}
                  placeholder={`Enter ${selectedCoin} address`}
                  placeholderTextColor={colors.mutedForeground}
                  value={toAddress}
                  onChangeText={setToAddress}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={async () => { const t = await Clipboard.getStringAsync(); if (t) setToAddress(t); }}
                  style={{ paddingHorizontal: 14 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.primary }}>Paste</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Amount input */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.8 }}>AMOUNT</Text>
                <TouchableOpacity onPress={() => setAmount(available.toFixed(8))}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.primary }}>MAX</Text>
                </TouchableOpacity>
              </View>
              <View style={{ backgroundColor: colors.secondary, borderRadius: 12, flexDirection: "row", alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 14 }}>
                <TextInput
                  style={{ flex: 1, fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground }}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>{selectedCoin}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>≈ ${usdValue.toFixed(2)} USD</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Avail: {available.toFixed(6)} {selectedCoin}</Text>
              </View>
              {/* Quick % */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["25%","50%","75%","100%"].map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setAmount((available * parseInt(p) / 100).toFixed(8))}
                    style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.secondary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center" }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Fee card */}
            {netMeta && (
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10 }}>
                {[
                  { label: "Network Fee", value: netMeta.withdrawFee },
                  { label: "Expected Arrival", value: netMeta.arrival },
                ].map((row, i) => (
                  <React.Fragment key={row.label}>
                    {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />}
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{row.label}</Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{row.value}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}

            {/* Warning */}
            <View style={{ backgroundColor: "#F0B90B12", borderRadius: 12, padding: 14, flexDirection: "row", gap: 10 }}>
              <Feather name="alert-triangle" size={15} color="#F0B90B" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#F0B90B", lineHeight: 18 }}>
                Withdrawals are processed within 24 hours. Always verify the destination address and network — crypto transactions cannot be reversed.
              </Text>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: submitting ? colors.border : colors.primary, marginTop: 4 }]}
              onPress={handleWithdraw}
              activeOpacity={0.85}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                : <Text style={[styles.confirmBtnText, { color: colors.primaryForeground }]}>{user?.twoFactorEnabled ? t("withdraw.continueTo2FA") : t("withdraw.continue")}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  navTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  navActions: { flexDirection: "row", gap: 8 },
  navBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", position: "relative" },
  tabRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2 },
  tabInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  balanceCard: { padding: 20, gap: 16 },
  balanceCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  balanceLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  balanceRow: { flexDirection: "row", alignItems: "center" },
  balanceValue: { fontSize: 30, fontFamily: "Inter_700Bold" },
  changeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  changeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  changeUsd: { fontSize: 12, fontFamily: "Inter_400Regular" },
  walletTypeBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  walletTypeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  liveDotSmall: { width: 5, height: 5, borderRadius: 2.5 },
  liveBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  actionRow: { flexDirection: "row", justifyContent: "space-around" },
  actionBtn: { alignItems: "center", gap: 6 },
  actionBtnCircle: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  actionBtnLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10 },
  addressText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  dexBtnRow: { flexDirection: "row", gap: 10 },
  dexBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12 },
  dexBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  allocationBar: { height: 6, flexDirection: "row", borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  allocationSegment: { height: 6 },
  allocationLegend: { flexDirection: "row", alignItems: "center", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  sectionAction: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 0 },
  assetList: {},
  assetItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  assetBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  assetTopRow: { flexDirection: "row", justifyContent: "space-between" },
  assetSymbol: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  assetUsd: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  assetBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  assetBalance: { fontSize: 12, fontFamily: "Inter_400Regular" },
  assetRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  assetPct: { fontSize: 11, fontFamily: "Inter_400Regular" },
  changePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4, marginTop: 2, borderTopWidth: StyleSheet.hairlineWidth },
  changeVal: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  txList: { overflow: "hidden" },
  txItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 16 },
  txBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  txIconBox: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  txType: { fontSize: 13, fontFamily: "Inter_500Medium" },
  txDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  txAmount: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  txUsd: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32, lineHeight: 20 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  depositCoinRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  depositCoinIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 20 },
  seedModal: { width: "100%", borderRadius: 20, overflow: "hidden" },
  seedModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  seedModalTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  seedWarning: { flexDirection: "row", alignItems: "center", gap: 8, margin: 16, padding: 12, borderRadius: 10 },
  seedWarningText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  seedGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16, paddingTop: 0 },
  seedChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minWidth: "30%", flex: 1 },
  seedNum: { fontSize: 10, fontFamily: "Inter_400Regular", minWidth: 14 },
  seedWordText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  seedCloseBtn: { margin: 16, marginTop: 0, padding: 15, borderRadius: 12, alignItems: "center" },
  seedCloseBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  transferContainer: { flex: 1 },
  transferHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  transferTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  transferLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  amountSection: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  amountHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  maxTag: { fontSize: 12, fontFamily: "Inter_700Bold" },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  amountInput: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  amountUsd: { fontSize: 12, fontFamily: "Inter_400Regular" },
  quickBtns: { flexDirection: "row", gap: 8 },
  quickBtn: { flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: "center" },
  quickBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  availText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  confirmBtn: { padding: 16, borderRadius: 14, alignItems: "center" },
  confirmBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  assetChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  assetChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  avatarCircle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  signInBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  signInText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  badge: { position: "absolute", top: -3, right: -3, minWidth: 15, height: 15, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  badgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" },
});
