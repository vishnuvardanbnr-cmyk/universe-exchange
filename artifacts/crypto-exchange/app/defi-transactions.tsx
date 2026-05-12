import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CoinLogo from "@/components/CoinLogo";
import { useTheme } from "@/context/ThemeContext";
import { useWallet, COIN_COLORS, DexTx } from "@/context/WalletContext";

const FILTERS = ["All", "Sent", "Received", "Deposit"] as const;
type FilterKey = (typeof FILTERS)[number];

const NETWORK_LABELS: Record<string, string> = {
  eth: "Ethereum", bsc: "BNB Chain", sol: "Solana", polygon: "Polygon", arbitrum: "Arbitrum",
};

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtUsd(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function shortHash(h: string) { return !h ? h : h.slice(0, 10) + "…" + h.slice(-8); }

export default function DefiTransactionsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { dexTxs } = useWallet();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [filter, setFilter] = useState<FilterKey>("All");
  const [detail, setDetail] = useState<DexTx | null>(
    focus ? dexTxs.find((t) => t.id === focus) ?? null : null
  );

  const filtered = useMemo(() => {
    if (filter === "All") return dexTxs;
    if (filter === "Sent") return dexTxs.filter((t) => t.kind === "send");
    if (filter === "Received") return dexTxs.filter((t) => t.kind === "receive");
    return dexTxs.filter((t) => t.kind === "deposit");
  }, [dexTxs, filter]);

  const grouped = useMemo(() => {
    const map: Record<string, DexTx[]> = {};
    for (const t of filtered) {
      const d = new Date(t.timestamp);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const ts = new Date(t.timestamp); ts.setHours(0, 0, 0, 0);
      const diff = (today.getTime() - ts.getTime()) / 86400000;
      let key: string;
      if (diff <= 0) key = "Today";
      else if (diff <= 1) key = "Yesterday";
      else if (diff <= 7) key = "This Week";
      else key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      (map[key] = map[key] ?? []).push(t);
    }
    return map;
  }, [filtered]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>Transactions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: "center" }}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => { setFilter(f); Haptics.selectionAsync(); }}
              style={{
                paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1,
                backgroundColor: active ? colors.primary : colors.card,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: active ? colors.primaryForeground : colors.foreground }}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}>
            <Feather name="inbox" size={36} color={colors.mutedForeground} />
          </View>
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground }}>No transactions yet</Text>
          <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center" }}>
            Send, receive, or deposit assets in your DeFi wallet to see them appear here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {Object.keys(grouped).map((dateKey) => (
            <View key={dateKey} style={{ marginBottom: 8 }}>
              <Text style={{ paddingHorizontal: 20, paddingVertical: 8, fontSize: 11, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 0.8 }}>{dateKey.toUpperCase()}</Text>
              <View style={{ paddingHorizontal: 16 }}>
                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {grouped[dateKey].map((t, i, arr) => {
                    const isOut = t.kind === "send";
                    const arrowColor = isOut ? "#F6465D" : t.kind === "deposit" ? "#F0B90B" : "#0ECB81";
                    return (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => setDetail(t)}
                        activeOpacity={0.75}
                        style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14 }, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                      >
                        <View style={{ position: "relative" }}>
                          <CoinLogo symbol={t.symbol} color={COIN_COLORS[t.symbol] ?? "#848E9C"} size={40} />
                          <View style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: arrowColor, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.card }}>
                            <Feather name={isOut ? "arrow-up" : "arrow-down"} size={9} color="#fff" />
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                            {t.kind === "send" ? `Sent ${t.symbol}` : t.kind === "receive" ? `Received ${t.symbol}` : t.kind === "deposit" ? `From Exchange` : t.kind}
                          </Text>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                            {new Date(t.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} · {NETWORK_LABELS[t.network] ?? t.network.toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: arrowColor }}>{isOut ? "-" : "+"}{t.amount.toFixed(6)}</Text>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{fmtUsd(t.usdValue)}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {detail && <TxDetailModal tx={detail} onClose={() => setDetail(null)} />}
    </View>
  );
}

function TxDetailModal({ tx, onClose }: { tx: DexTx; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isOut = tx.kind === "send";
  const arrowColor = isOut ? "#F6465D" : tx.kind === "deposit" ? "#F0B90B" : "#0ECB81";

  const copy = async (txt: string) => {
    await Clipboard.setStringAsync(txt);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: insets.bottom }}>
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={s.iconBtn}>
            <Feather name="x" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>Transaction Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 12 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: arrowColor + "18", alignItems: "center", justifyContent: "center" }}>
              <Feather name={isOut ? "arrow-up-right" : "arrow-down-left"} size={36} color={arrowColor} />
            </View>
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>
              {isOut ? "Sent" : tx.kind === "deposit" ? "Deposit" : "Received"}
            </Text>
            <Text style={{ fontSize: 30, fontFamily: "Inter_700Bold", color: colors.foreground }}>
              {isOut ? "-" : "+"}{tx.amount.toFixed(6)} {tx.symbol}
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{fmtUsd(tx.usdValue)}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: tx.status === "completed" ? "#0ECB8118" : "#F0B90B18" }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tx.status === "completed" ? "#0ECB81" : "#F0B90B" }} />
              <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: tx.status === "completed" ? "#0ECB81" : "#F0B90B" }}>
                {tx.status === "completed" ? "Confirmed" : "Pending"}
              </Text>
            </View>
          </View>

          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <DRow label="Network" value={NETWORK_LABELS[tx.network] ?? tx.network} colors={colors} />
            <DRow label="From" value={tx.from ?? "—"} mono colors={colors} onCopy={tx.from ? () => copy(tx.from!) : undefined} />
            <DRow label="To" value={tx.to ?? "—"} mono colors={colors} onCopy={tx.to ? () => copy(tx.to!) : undefined} />
            <DRow label="Tx Hash" value={shortHash(tx.hash)} mono colors={colors} onCopy={() => copy(tx.hash)} />
            <DRow label="Network Fee" value={tx.gasFee > 0 ? `${tx.gasFee.toFixed(6)} ${tx.network === "eth" ? "ETH" : tx.network === "bsc" ? "BNB" : "SOL"}` : "Free"} colors={colors} />
            <DRow label="Date" value={fmtTime(tx.timestamp)} colors={colors} last />
          </View>

          <TouchableOpacity onPress={() => copy(tx.hash)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, backgroundColor: colors.primary }}>
            <Feather name="external-link" size={15} color={colors.primaryForeground} />
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.primaryForeground }}>Copy Hash</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function DRow({ label, value, colors, onCopy, last, mono }: { label: string; value: string; colors: any; onCopy?: () => void; last?: boolean; mono?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontFamily: mono ? "Inter_500Medium" : "Inter_600SemiBold", color: colors.foreground, maxWidth: "60%", textAlign: "right" }} numberOfLines={1} ellipsizeMode="middle">{value}</Text>
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
  card: { borderRadius: 16, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth },
});
