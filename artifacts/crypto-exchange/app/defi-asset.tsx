import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CoinLogo from "@/components/CoinLogo";
import { useTheme } from "@/context/ThemeContext";
import { useLivePrice } from "@/context/LivePriceContext";
import { useWallet, COIN_COLORS, COIN_NAMES } from "@/context/WalletContext";

const NETWORK_LABELS: Record<string, string> = {
  eth: "Ethereum", bsc: "BNB Chain", sol: "Solana", polygon: "Polygon",
  arbitrum: "Arbitrum", btc: "Bitcoin", xrp: "XRP Ledger", ada: "Cardano",
  dot: "Polkadot", cosmos: "Cosmos", trx: "Tron", avax: "Avalanche",
  aptos: "Aptos", sui: "Sui", inj: "Injective",
};

const COIN_CHAIN: Record<string, string> = {
  ETH:"eth", LINK:"eth", UNI:"eth", USDT:"eth", USDC:"eth",
  BNB:"bsc", SOL:"sol", NEAR:"sol", MATIC:"polygon",
  ARB:"arbitrum", OP:"arbitrum", BTC:"btc", DOGE:"btc", LTC:"btc",
  XRP:"xrp", ADA:"ada", DOT:"dot", ATOM:"cosmos", TRX:"trx",
  AVAX:"avax", APT:"aptos", SUI:"sui", INJ:"inj",
};

function shortAddr(a: string) { return !a || a.length < 12 ? a : a.slice(0, 8) + "…" + a.slice(-6); }
function fmtUsd(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DefiAssetScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { dexBalances, dexTxs, dexAddress } = useWallet();
  const { getPrice } = useLivePrice();

  const sym = (symbol ?? "").toUpperCase();
  const balance = dexBalances.find((b) => b.symbol === sym);
  const price = getPrice(sym);
  const liveUsd = balance ? balance.balance * (price > 0 ? price : 0) : 0;
  const network = COIN_CHAIN[sym] ?? "eth";
  const networkLabel = NETWORK_LABELS[network] ?? "Ethereum";
  const color = COIN_COLORS[sym] ?? "#848E9C";

  const txs = useMemo(() => dexTxs.filter((t) => t.symbol === sym), [dexTxs, sym]);

  const contractAddress = useMemo(() => {
    let h = 0;
    for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) >>> 0;
    let addr = "0x";
    let x = h;
    for (let i = 0; i < 40; i++) { addr += (x & 0xf).toString(16); x = (x * 1103515245 + 12345) >>> 0; }
    return addr;
  }, [sym]);

  const copy = async (txt: string, label: string) => {
    await Clipboard.setStringAsync(txt);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>{sym}</Text>
          <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{COIN_NAMES[sym] ?? sym}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/defi-transactions")} style={s.iconBtn}>
          <Feather name="clock" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[s.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ alignItems: "center", gap: 14 }}>
            <CoinLogo symbol={sym} color={color} size={64} />
            <View style={{ alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 32, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                {balance ? balance.balance.toFixed(balance.balance < 0.001 ? 8 : 6) : "0.000000"} {sym}
              </Text>
              <Text style={{ fontSize: 16, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{fmtUsd(liveUsd)}</Text>
            </View>
            <View style={[s.netBadge, { backgroundColor: color + "18" }]}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
              <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color }}>{networkLabel.toUpperCase()}</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
            {[
              { icon: "send", label: "Send", color: "#F6465D" },
              { icon: "download", label: "Receive", color: "#0ECB81" },
              { icon: "repeat", label: "Swap", color: "#628EEA" },
            ].map((a) => (
              <TouchableOpacity
                key={a.label}
                onPress={() => { Haptics.selectionAsync(); router.back(); }}
                activeOpacity={0.8}
                style={[s.actionBtn, { backgroundColor: a.color + "18", borderColor: a.color + "30" }]}
              >
                <Feather name={a.icon as any} size={16} color={a.color} />
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: a.color }}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Asset info */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>ASSET INFO</Text>
          <Row label="Network" value={networkLabel} colors={colors} />
          <Row label="Live Price" value={price > 0 ? fmtUsd(price) : "—"} colors={colors} />
          <Row label="Decimals" value={sym === "BTC" ? "8" : sym === "USDT" || sym === "USDC" ? "6" : "18"} colors={colors} />
          <Row label="Contract" value={shortAddr(contractAddress)} colors={colors} onCopy={() => copy(contractAddress, "Contract")} />
          <Row label="My Wallet" value={shortAddr(dexAddress)} colors={colors} onCopy={() => copy(dexAddress, "Wallet address")} last />
        </View>

        {/* Transactions */}
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingHorizontal: 4 }}>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground, marginBottom: 0 }]}>RECENT ACTIVITY</Text>
            {txs.length > 0 && (
              <TouchableOpacity onPress={() => router.push("/defi-transactions")}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: colors.primary }}>View All</Text>
              </TouchableOpacity>
            )}
          </View>
          {txs.length === 0 ? (
            <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="inbox" size={28} color={colors.border} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>No activity yet</Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center" }}>
                Send or receive {sym} to see transactions here.
              </Text>
            </View>
          ) : (
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 0 }]}>
              {txs.slice(0, 8).map((t, i) => {
                const isOut = t.kind === "send";
                const arrowColor = isOut ? "#F6465D" : "#0ECB81";
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => router.push({ pathname: "/defi-transactions", params: { focus: t.id } })}
                    activeOpacity={0.7}
                    style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }, i < Math.min(txs.length, 8) - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: arrowColor + "18", alignItems: "center", justifyContent: "center" }}>
                      <Feather name={isOut ? "arrow-up-right" : "arrow-down-left"} size={16} color={arrowColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                        {t.kind === "send" ? "Sent" : t.kind === "receive" ? "Received" : t.kind === "deposit" ? "From Exchange" : t.kind}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{fmtTime(t.timestamp)}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: arrowColor }}>{isOut ? "-" : "+"}{t.amount.toFixed(6)}</Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{fmtUsd(t.usdValue)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, colors, onCopy, last }: { label: string; value: string; colors: any; onCopy?: () => void; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{value}</Text>
      {onCopy && (
        <TouchableOpacity onPress={onCopy} style={{ paddingLeft: 10 }}>
          <Feather name="copy" size={13} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  hero: { borderRadius: 22, padding: 22, borderWidth: StyleSheet.hairlineWidth },
  netBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  card: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, marginBottom: 4 },
  empty: { borderRadius: 18, padding: 28, alignItems: "center", gap: 10, borderWidth: StyleSheet.hairlineWidth },
});
