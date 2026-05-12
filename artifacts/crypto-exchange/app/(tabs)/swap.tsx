import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useWallet, COIN_PRICES } from "@/context/WalletContext";
import { useUserWallet } from "@/context/UserWalletContext";
import { useAuth } from "@/context/AuthContext";
import { useLivePrice } from "@/context/LivePriceContext";
import { MARKET_DATA, formatPrice } from "@/data/marketData";
import CoinLogo from "@/components/CoinLogo";

const SWAPPABLE = ["BTC","ETH","BNB","SOL","XRP","ADA","AVAX","MATIC","LINK","DOT","NEAR","ARB","OP","APT","SUI","USDT","USDC"];
const HISTORY_KEY = "cryptox_swap_history_v1";
const PAGE_SIZE = 5;

type SwapRecord = {
  id: string;
  fromSymbol: string; toSymbol: string;
  fromAmount: number; toAmount: number;
  usdValue: number; rate: number; fee: number; timestamp: number;
};

export default function SwapScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { cexBalances, swapCoins } = useWallet();
  const { balances: serverBalances } = useUserWallet();
  const { user } = useAuth();
  const { getPrice, getTicker, connected } = useLivePrice();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const scrollRef = useRef<ScrollView>(null);

  const [fromSymbol, setFromSymbol] = useState("USDT");
  const [toSymbol, setToSymbol] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [slippage, setSlippage] = useState("0.5");
  const [showSlippage, setShowSlippage] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [history, setHistory] = useState<SwapRecord[]>([]);
  const [page, setPage] = useState(0);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(raw => {
      if (raw) setHistory(JSON.parse(raw));
    });
  }, []);

  const liveFrom = getPrice(fromSymbol);
  const liveTo = getPrice(toSymbol);
  const fromPrice = liveFrom > 0 ? liveFrom : (COIN_PRICES[fromSymbol] ?? 1);
  const toPrice = liveTo > 0 ? liveTo : (COIN_PRICES[toSymbol] ?? 1);
  const numAmount = parseFloat(amount) || 0;
  const usdValue = numAmount * fromPrice;
  const FEE_RATE = 0.001;
  const toAmountRaw = toPrice > 0 ? (usdValue * (1 - FEE_RATE)) / toPrice : 0;
  const toAmount = toAmountRaw;
  const rate = toPrice > 0 ? fromPrice / toPrice : 0;
  const serverFromBal = serverBalances.find(b => b.coin === fromSymbol);
  const localFromBal = cexBalances.find(c => c.symbol === fromSymbol);
  const fromBalanceAmt = user
    ? (serverFromBal ? serverFromBal.available + serverFromBal.locked : 0)
    : (localFromBal?.balance ?? 0);
  const fromBalance = { balance: fromBalanceAmt };
  const slippageAmount = toAmount * (parseFloat(slippage) / 100);
  const minReceived = toAmount - slippageAmount;
  const fee = usdValue * FEE_RATE;
  const fromCoin = MARKET_DATA.find(c => c.symbol === fromSymbol);
  const toCoin = MARKET_DATA.find(c => c.symbol === toSymbol);
  const fromTicker = getTicker(fromSymbol);
  const change = fromTicker?.change24h ?? fromCoin?.change24h ?? 0;
  const totalPages = Math.ceil(history.length / PAGE_SIZE);
  const pagedHistory = history.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const insufficient = numAmount > 0 && (fromBalance?.balance ?? 0) < numAmount;

  const saveHistory = async (records: SwapRecord[]) => {
    setHistory(records);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(records));
  };

  const handleFlip = () => {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
    setAmount("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(spinAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(spinAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]).start();
  };

  const handleSwap = async () => {
    if (numAmount <= 0) { Alert.alert("Enter Amount"); return; }
    if (!fromBalance || fromBalance.balance < numAmount) {
      Alert.alert("Insufficient Balance", `You don't have enough ${fromSymbol}.`); return;
    }
    setSwapping(true);
    await new Promise(r => setTimeout(r, 900));
    const success = swapCoins(fromSymbol, toSymbol, numAmount, fromPrice, toPrice);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const record: SwapRecord = {
        id: Date.now().toString(),
        fromSymbol, toSymbol, fromAmount: numAmount, toAmount,
        usdValue, rate, fee, timestamp: Date.now(),
      };
      const updated = [record, ...history].slice(0, 100);
      await saveHistory(updated);
      setPage(0);
      setAmount("");
    }
    setSwapping(false);
  };

  const spinRotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  const btnLabel = insufficient
    ? `Insufficient ${fromSymbol}`
    : numAmount > 0
    ? `Swap ${fromSymbol} → ${toSymbol}`
    : "Enter an amount";
  const btnEnabled = numAmount > 0 && !insufficient && !swapping;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.background }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Swap</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Instant token exchange</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowSlippage(true)}
            activeOpacity={0.75}
          >
            <Feather name="sliders" size={14} color={colors.mutedForeground} />
            <Text style={[styles.slippageBtnText, { color: colors.mutedForeground }]}>{slippage}%</Text>
          </TouchableOpacity>
          <View style={[styles.liveBadge, { backgroundColor: connected ? "#0ECB8112" : "#84848412", borderColor: connected ? "#0ECB8130" : colors.border }]}>
            <View style={[styles.liveDot, { backgroundColor: connected ? "#0ECB81" : "#848484" }]} />
            <Text style={[styles.liveBadgeText, { color: connected ? "#0ECB81" : colors.mutedForeground }]}>
              {connected ? "Live" : "Offline"}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 0 }} showsVerticalScrollIndicator={false}>

        {/* ── From card ── */}
        <View style={[styles.swapCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardTopRow}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>You Pay</Text>
            {numAmount > 0 && (
              <Text style={[styles.usdEquiv, { color: colors.mutedForeground }]}>
                ≈ ${usdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            )}
          </View>

          <View style={styles.tokenRow}>
            <TouchableOpacity
              style={[styles.tokenSelector, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => setShowFromPicker(true)}
              activeOpacity={0.75}
            >
              {fromCoin && <CoinLogo logo={fromCoin.logo} symbol={fromCoin.symbol} color={fromCoin.color} size={28} />}
              <Text style={[styles.tokenSymbol, { color: colors.foreground }]}>{fromSymbol}</Text>
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TextInput
              style={[styles.amountInput, { color: colors.foreground }]}
              placeholder="0.00"
              placeholderTextColor={colors.border}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              textAlign="right"
            />
          </View>

          <View style={styles.balanceRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Feather name="credit-card" size={10} color={colors.mutedForeground} />
              <Text style={[styles.balanceText, { color: colors.mutedForeground }]}>
                {(fromBalance?.balance ?? 0).toLocaleString("en-US", {
                  minimumFractionDigits: fromBalance && fromBalance.balance > 10 ? 2 : 4,
                  maximumFractionDigits: fromBalance && fromBalance.balance > 10 ? 2 : 6,
                })} {fromSymbol}
              </Text>
              {change !== 0 && (
                <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: change >= 0 ? "#0ECB81" : "#F6465D" }}>
                  {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                </Text>
              )}
            </View>
            <View style={styles.pctRow}>
              {["25%", "50%", "Max"].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.pctBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  onPress={() => {
                    const bal = fromBalance?.balance ?? 0;
                    const frac = p === "Max" ? 1 : parseInt(p) / 100;
                    const val = bal * frac;
                    setAmount(val > 0 ? (val > 1 ? val.toFixed(4) : val.toFixed(6)) : "0");
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pctBtnText, { color: p === "Max" ? colors.primary : colors.mutedForeground }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {insufficient && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={12} color="#F6465D" />
              <Text style={styles.errorText}>Insufficient balance</Text>
            </View>
          )}
        </View>

        {/* ── Flip ── */}
        <View style={styles.flipContainer}>
          <View style={[styles.flipDivider, { backgroundColor: colors.border }]} />
          <Animated.View style={{ transform: [{ rotate: spinRotate }] }}>
            <TouchableOpacity
              style={[styles.flipBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={handleFlip}
              activeOpacity={0.75}
            >
              <Feather name="arrow-down" size={16} color={colors.primary} />
            </TouchableOpacity>
          </Animated.View>
          <View style={[styles.flipDivider, { backgroundColor: colors.border }]} />
        </View>

        {/* ── To card ── */}
        <View style={[styles.swapCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardTopRow}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>You Receive</Text>
            {numAmount > 0 && (
              <Text style={[styles.usdEquiv, { color: colors.mutedForeground }]}>
                ≈ ${(toAmount * toPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            )}
          </View>
          <View style={styles.tokenRow}>
            <TouchableOpacity
              style={[styles.tokenSelector, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => setShowToPicker(true)}
              activeOpacity={0.75}
            >
              {toCoin && <CoinLogo logo={toCoin.logo} symbol={toCoin.symbol} color={toCoin.color} size={28} />}
              <Text style={[styles.tokenSymbol, { color: colors.foreground }]}>{toSymbol}</Text>
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            <Text style={[styles.receiveAmount, { color: numAmount > 0 ? "#0ECB81" : colors.border }]}>
              {numAmount > 0
                ? toAmount.toLocaleString("en-US", { minimumFractionDigits: toAmount > 1 ? 2 : 4, maximumFractionDigits: toAmount > 1 ? 4 : 8 })
                : "0.00"}
            </Text>
          </View>
        </View>

        {/* ── Rate info ── */}
        <View style={[styles.rateRow, { backgroundColor: colors.secondary }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={[styles.liveDot, { backgroundColor: connected ? "#0ECB81" : "#848484" }]} />
            <Text style={[styles.rateText, { color: colors.mutedForeground }]}>
              {numAmount > 0
                ? `1 ${fromSymbol} ≈ ${rate.toLocaleString("en-US", { minimumFractionDigits: rate > 1 ? 2 : 4, maximumFractionDigits: rate > 1 ? 4 : 8 })} ${toSymbol}`
                : `Live rates · ${slippage}% slippage`}
            </Text>
          </View>
          <View style={[styles.feePill, { backgroundColor: "#F0B90B10", borderColor: "#F0B90B28" }]}>
            <Feather name="zap" size={9} color="#F0B90B" />
            <Text style={[styles.feePillText, { color: "#F0B90B" }]}>0.1% fee</Text>
          </View>
        </View>

        {/* ── Transaction details (collapsible) ── */}
        {numAmount > 0 && (
          <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.detailsToggleRow}
              onPress={() => { setDetailsExpanded(v => !v); Haptics.selectionAsync(); }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Feather name="info" size={12} color={colors.mutedForeground} />
                <Text style={[styles.detailsToggleText, { color: colors.mutedForeground }]}>Transaction details</Text>
              </View>
              <Feather name={detailsExpanded ? "chevron-up" : "chevron-down"} size={13} color={colors.mutedForeground} />
            </TouchableOpacity>

            {detailsExpanded && (
              <View style={[styles.detailsBody, { borderTopColor: colors.border }]}>
                {[
                  { label: "Rate", value: `1 ${fromSymbol} = ${rate.toFixed(rate > 1 ? 4 : 8)} ${toSymbol}` },
                  { label: "Min. Received", value: `${minReceived.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 8 })} ${toSymbol}`, green: true },
                  { label: "Slippage Tolerance", value: `${slippage}%` },
                  { label: "Network Fee", value: `$${fee.toFixed(4)}`, sub: "0.1%" },
                  { label: "Price Impact", value: "< 0.01%", green: true },
                  { label: "Route", value: `${fromSymbol} → ${toSymbol}` },
                ].map((d, i) => (
                  <View key={d.label} style={[styles.detailRow, { borderTopColor: colors.border, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth }]}>
                    <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{d.label}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      {d.sub && <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{d.sub}</Text>}
                      <Text style={[styles.detailValue, { color: d.green ? "#0ECB81" : colors.foreground }]}>{d.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Swap button ── */}
        <TouchableOpacity
          style={[styles.swapBtn, {
            backgroundColor: insufficient ? "#F6465D10" : btnEnabled ? colors.primary : colors.secondary,
            borderWidth: insufficient ? 1 : 0,
            borderColor: insufficient ? "#F6465D30" : "transparent",
            opacity: swapping ? 0.8 : 1,
          }]}
          onPress={handleSwap}
          disabled={!btnEnabled}
          activeOpacity={0.85}
        >
          {swapping ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Animated.View style={{ transform: [{ rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
                <Feather name="loader" size={16} color={colors.primaryForeground} />
              </Animated.View>
              <Text style={[styles.swapBtnText, { color: colors.primaryForeground }]}>Swapping…</Text>
            </View>
          ) : (
            <Text style={[styles.swapBtnText, {
              color: insufficient ? "#F6465D" : btnEnabled ? colors.primaryForeground : colors.mutedForeground,
            }]}>
              {btnLabel}
            </Text>
          )}
        </TouchableOpacity>

        {/* ── History ── */}
        {history.length > 0 && (
          <View style={{ marginTop: 28, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground }}>Swap History</Text>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{history.length} total</Text>
            </View>

            <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {pagedHistory.map((rec, i) => {
                const d = new Date(rec.timestamp);
                const dateStr = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
                return (
                  <View key={rec.id} style={[styles.historyRow, { borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                    <View style={[styles.historyIconWrap, { backgroundColor: "#0ECB8112" }]}>
                      <Feather name="repeat" size={14} color="#0ECB81" />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>{rec.fromSymbol}</Text>
                        <Feather name="arrow-right" size={11} color={colors.mutedForeground} />
                        <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>{rec.toSymbol}</Text>
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                        {dateStr} · {timeStr}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 3 }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0ECB81" }}>
                        +{rec.toAmount.toLocaleString("en-US", { maximumFractionDigits: rec.toAmount > 1 ? 4 : 6 })} {rec.toSymbol}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                        −{rec.fromAmount.toLocaleString("en-US", { maximumFractionDigits: rec.fromAmount > 1 ? 4 : 6 })} {rec.fromSymbol}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity onPress={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={[styles.pageBtn, { backgroundColor: colors.secondary, opacity: page === 0 ? 0.35 : 1 }]}>
                  <Feather name="chevron-left" size={16} color={colors.foreground} />
                </TouchableOpacity>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <TouchableOpacity key={i} onPress={() => setPage(i)} style={[styles.pageNumBtn, { backgroundColor: page === i ? colors.primary : colors.secondary }]}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: page === i ? colors.primaryForeground : colors.mutedForeground }}>{i + 1}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={[styles.pageBtn, { backgroundColor: colors.secondary, opacity: page === totalPages - 1 ? 0.35 : 1 }]}>
                  <Feather name="chevron-right" size={16} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Slippage modal ── */}
      <Modal visible={showSlippage} transparent animationType="fade" onRequestClose={() => setShowSlippage(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSlippage(false)}>
          <View style={[styles.slippageSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Slippage Tolerance</Text>
            <Text style={[styles.sheetDesc, { color: colors.mutedForeground }]}>
              Your transaction will revert if the price moves unfavorably by more than this amount.
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[{ v: "0.1", label: "Strict" }, { v: "0.5", label: "Default" }, { v: "1.0", label: "Relaxed" }].map(({ v, label }) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => { setSlippage(v); setShowSlippage(false); Haptics.selectionAsync(); }}
                  style={[styles.slippageOption, { backgroundColor: slippage === v ? colors.primary : colors.secondary, borderColor: slippage === v ? colors.primary : colors.border }]}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: slippage === v ? colors.primaryForeground : colors.foreground }}>{v}%</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: slippage === v ? colors.primaryForeground + "CC" : colors.mutedForeground, marginTop: 3 }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <CoinPickerModal visible={showFromPicker} onClose={() => setShowFromPicker(false)} onSelect={s => { setFromSymbol(s); setShowFromPicker(false); setAmount(""); }} exclude={toSymbol} title="Pay with" />
      <CoinPickerModal visible={showToPicker} onClose={() => setShowToPicker(false)} onSelect={s => { setToSymbol(s); setShowToPicker(false); }} exclude={fromSymbol} title="Receive" />
    </View>
  );
}

function CoinPickerModal({ visible, onClose, onSelect, exclude, title }: { visible: boolean; onClose: () => void; onSelect: (s: string) => void; exclude: string; title: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getPrice, getTicker } = useLivePrice();
  const [search, setSearch] = useState("");

  const filtered = SWAPPABLE.filter(s => s !== exclude && s.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.pickerWrapper, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.pickerCloseBtn}>
            <Feather name="x" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.pickerTitle, { color: colors.foreground }]}>{title}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={[styles.pickerSearch, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="search" size={14} color={colors.mutedForeground} />
          <TextInput
            style={[styles.pickerSearchInput, { color: colors.foreground }]}
            placeholder="Search token…"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x-circle" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {filtered.map(sym => {
            const coin = MARKET_DATA.find(c => c.symbol === sym);
            const liveP = getPrice(sym);
            const ticker = getTicker(sym);
            const price = liveP > 0 ? liveP : (COIN_PRICES[sym] ?? 1);
            const change24h = ticker ? ticker.change24h : (coin?.change24h ?? 0);
            return (
              <TouchableOpacity
                key={sym}
                style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                onPress={() => { onSelect(sym); setSearch(""); Haptics.selectionAsync(); }}
                activeOpacity={0.7}
              >
                {coin ? <CoinLogo logo={coin.logo} symbol={coin.symbol} color={coin.color} size={42} /> : <View style={{ width: 42 }} />}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.pickerItemSymbol, { color: colors.foreground }]}>{sym}</Text>
                  <Text style={[styles.pickerItemName, { color: colors.mutedForeground }]}>{coin?.name ?? sym}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 3 }}>
                  <Text style={[styles.pickerItemPrice, { color: colors.foreground }]}>${formatPrice(price)}</Text>
                  <Text style={[styles.pickerItemChange, { color: change24h >= 0 ? "#0ECB81" : "#F6465D" }]}>
                    {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  settingsBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  slippageBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  swapCard: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 14 },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, textTransform: "uppercase" },
  usdEquiv: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tokenRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  tokenSelector: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth },
  tokenSymbol: { fontSize: 16, fontFamily: "Inter_700Bold" },
  amountInput: { flex: 1, fontSize: 32, fontFamily: "Inter_700Bold", padding: 0 },
  receiveAmount: { flex: 1, fontSize: 32, fontFamily: "Inter_700Bold", textAlign: "right" },
  balanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  balanceText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  pctRow: { flexDirection: "row", gap: 5 },
  pctBtn: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  pctBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F6465D0D", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#F6465D" },

  flipContainer: { flexDirection: "row", alignItems: "center", paddingVertical: 2 },
  flipDivider: { flex: 1, height: StyleSheet.hairlineWidth },
  flipBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginHorizontal: 14, borderWidth: 1.5 },

  rateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 10 },
  rateText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  feePill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  feePillText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  detailsCard: { marginTop: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  detailsToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 13 },
  detailsToggleText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  detailsBody: { borderTopWidth: StyleSheet.hairlineWidth },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11 },
  detailLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  detailValue: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  swapBtn: { marginTop: 14, borderRadius: 18, paddingVertical: 18, alignItems: "center", justifyContent: "center" },
  swapBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },

  historyCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  historyIconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  pageBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  pageNumBtn: { minWidth: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },

  modalOverlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
  slippageSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  sheetHandle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  sheetDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  slippageOption: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: "center", borderWidth: 1 },

  pickerWrapper: { flex: 1 },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerCloseBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  pickerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  pickerSearch: { flexDirection: "row", alignItems: "center", gap: 8, margin: 16, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  pickerSearchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  pickerItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerItemSymbol: { fontSize: 15, fontFamily: "Inter_700Bold" },
  pickerItemName: { fontSize: 12, fontFamily: "Inter_400Regular" },
  pickerItemPrice: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  pickerItemChange: { fontSize: 11, fontFamily: "Inter_500Medium" },
});
