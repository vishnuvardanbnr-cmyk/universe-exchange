import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
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
import { useUserWallet } from "@/context/UserWalletContext";
import { useLivePrice } from "@/context/LivePriceContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { MARKET_DATA, MarketCoin, formatPrice, formatVolume } from "@/data/marketData";
import CoinLogo from "@/components/CoinLogo";

const FILTERS = ["All", "Gainers", "Losers", "Volume", "Market Cap"];
// Fixed column widths for horizontal-scrollable market list
const COL = { name: 130, price: 105, change: 88, vol: 82, mcap: 88 };

function ConnectionDot({ connected }: { connected: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!connected) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [connected]);
  return (
    <Animated.View style={[styles.connDot, { backgroundColor: connected ? "#00C087" : "#FF4B4B", opacity: connected ? pulse : 1 }]} />
  );
}

function PriceCell({ symbol, price, change24h, width }: { symbol: string; price: number; change24h: number; width?: number }) {
  const { colors } = useTheme();
  const flashAnim = useRef(new Animated.Value(0)).current;
  const prevPrice = useRef(price);
  const prevIsPos = useRef(change24h >= 0);

  useEffect(() => {
    if (price > 0 && price !== prevPrice.current) {
      prevIsPos.current = change24h >= 0;
      prevPrice.current = price;
      flashAnim.setValue(1);
      Animated.timing(flashAnim, { toValue: 0, duration: 700, useNativeDriver: false }).start();
    }
  }, [price]);

  const isPos = change24h >= 0;
  const bg = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", prevIsPos.current ? "#00C08740" : "#FF4B4B40"],
  });

  return (
    <Animated.View style={[styles.priceCell, { backgroundColor: bg, width: width ?? undefined }]}>
      <Text style={[styles.rowPrice, { color: colors.foreground }]}>${formatPrice(price)}</Text>
    </Animated.View>
  );
}

function getGreeting(t: (k: string, v?: Record<string, string | number>) => string, displayName?: string): string {
  const firstName = displayName?.trim().split(/\s+/)[0];
  return firstName ? t("greeting.helloName", { name: firstName }) : t("greeting.hello");
}

export default function MarketsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { balances: userBalances, loading: walletLoading, tradableCoins } = useUserWallet();
  const { user } = useAuth();
  const { t } = useI18n();
  const { tickers, connected, getPrice, getChange } = useLivePrice();
  const { unreadCount } = useNotifications();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Reset to first page when filter or search changes
  useEffect(() => { setPage(1); }, [filter, search]);
  const scrollRef = useRef<ScrollView>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  // Only show coins the admin has actually enabled for trading/deposit/withdraw.
  // Fall back to the full list while tradableCoins is still loading so the screen never appears empty.
  const tradableSet = new Set(tradableCoins);
  const enabledMarket = tradableCoins.length > 0
    ? MARKET_DATA.filter((c) => tradableSet.has(c.symbol))
    : MARKET_DATA;

  const enriched = enabledMarket.map((coin) => {
    const ticker = tickers[coin.symbol];
    return {
      ...coin,
      price: ticker ? ticker.price : coin.price,
      change24h: ticker ? ticker.change24h : coin.change24h,
      high24h: ticker ? ticker.high24h : coin.high24h,
      low24h: ticker ? ticker.low24h : coin.low24h,
      volume24h: ticker ? ticker.quoteVolume24h : coin.volume24h,
    };
  });

  let filtered = enriched.filter(
    (c) =>
      c.symbol.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
  );
  if (filter === "Gainers") filtered = [...filtered].sort((a, b) => b.change24h - a.change24h);
  else if (filter === "Losers") filtered = [...filtered].sort((a, b) => a.change24h - b.change24h);
  else if (filter === "Volume") filtered = [...filtered].sort((a, b) => b.volume24h - a.volume24h);
  else if (filter === "Market Cap") filtered = [...filtered].sort((a, b) => b.marketCap - a.marketCap);

  const trending = [...enriched]
    .filter((c) => c.symbol !== "USDT" && c.symbol !== "USDC")
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
    .slice(0, 5);

  const liveTotalUsd = (user && !walletLoading)
    ? userBalances.reduce((sum, b) => {
        const lp = getPrice(b.coin);
        return sum + (lp > 0 ? (b.available + b.locked) * lp : 0);
      }, 0)
    : 0;

  const tableWidth = COL.name + COL.price + COL.change + COL.vol + COL.mcap;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Fixed top bar */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.background }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{getGreeting(t, user?.displayName)}</Text>
          <Text style={[styles.portfolioVal, { color: colors.foreground }]}>
            ${liveTotalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.connBadge, { backgroundColor: colors.secondary }]}>
            <ConnectionDot connected={connected} />
            <Text style={[styles.connText, { color: connected ? "#00C087" : colors.mutedForeground }]}>
              {connected ? t("greeting.live") : t("greeting.connecting")}
            </Text>
          </View>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.secondary }]} onPress={() => router.push("/(tabs)/notifications")}>
            <Feather name="bell" size={17} color={colors.mutedForeground} />
            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: "#FF4B4B" }]}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : String(unreadCount)}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.secondary }]} onPress={() => router.push("/settings")}>
            <Feather name="settings" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main vertical scroll */}
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Stats chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <StatChip label="24h Vol" value="$94.2B" icon="activity" color={colors.primary} colors={colors} />
          <StatChip label="Market Cap" value="$2.48T" icon="globe" color={colors.success} colors={colors} />
          <StatChip label="BTC Dom." value="53.2%" icon="pie-chart" color={colors.foreground} colors={colors} />
          <StatChip label="Fear & Greed" value="72 Greed" icon="trending-up" color="#F0B90B" colors={colors} />
        </ScrollView>

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.secondary }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search coins, tokens..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Trending */}
        {!search && (
          <View style={{ marginBottom: 4 }}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>TRENDING</Text>
              <View style={[styles.liveTagWrap, { backgroundColor: connected ? "#00C08718" : colors.secondary }]}>
                <ConnectionDot connected={connected} />
                <Text style={[styles.liveTagText, { color: connected ? "#00C087" : colors.mutedForeground }]}>
                  {connected ? "LIVE" : "LOADING"}
                </Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendScroll}>
              {trending.map((coin) => {
                const isPos = coin.change24h >= 0;
                return (
                  <TouchableOpacity
                    key={coin.symbol}
                    style={[styles.trendCard, { backgroundColor: colors.card }]}
                    onPress={() => router.push({ pathname: "/(tabs)/trade", params: { symbol: coin.symbol } })}
                    activeOpacity={0.8}
                  >
                    <CoinLogo logo={coin.logo} symbol={coin.symbol} color={coin.color} size={36} />
                    <Text style={[styles.trendSymbol, { color: colors.foreground }]}>{coin.symbol}</Text>
                    <Text style={[styles.trendPrice, { color: colors.mutedForeground }]}>${formatPrice(coin.price)}</Text>
                    <View style={[styles.trendChangeBadge, { backgroundColor: isPos ? "#00C08720" : "#FF4B4B20" }]}>
                      <Text style={[styles.trendChange, { color: isPos ? "#00C087" : "#FF4B4B" }]}>
                        {isPos ? "+" : ""}{coin.change24h.toFixed(2)}%
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterChip, { backgroundColor: filter === f ? colors.primary : colors.secondary }]}
            >
              <Text style={[styles.filterText, { color: filter === f ? colors.primaryForeground : colors.mutedForeground }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Market table — scrollable left/right */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
          <View style={{ width: tableWidth }}>
            {/* Column header */}
            <View style={[styles.listHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.listHeaderText, { color: colors.mutedForeground, width: COL.name }]}>Name</Text>
              <Text style={[styles.listHeaderText, { color: colors.mutedForeground, width: COL.price, textAlign: "right" }]}>Price</Text>
              <Text style={[styles.listHeaderText, { color: colors.mutedForeground, width: COL.change, textAlign: "right" }]}>24h %</Text>
              <Text style={[styles.listHeaderText, { color: colors.mutedForeground, width: COL.vol, textAlign: "right" }]}>Vol</Text>
              <Text style={[styles.listHeaderText, { color: colors.mutedForeground, width: COL.mcap, textAlign: "right" }]}>MCap</Text>
            </View>
            {/* Coin rows */}
            {pagedRows.map((item, index) => (
              <MarketRow
                key={item.symbol}
                coin={item}
                rank={pageStart + index + 1}
                onPress={() => router.push({ pathname: "/(tabs)/trade", params: { symbol: item.symbol } })}
              />
            ))}
            {pagedRows.length === 0 && (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>No coins match your search.</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Pagination */}
        {filtered.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingHorizontal: 16, paddingVertical: 14, marginTop: 4 }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
              {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity onPress={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
                  backgroundColor: colors.secondary, opacity: currentPage === 1 ? 0.4 : 1 }}>
                <Feather name="chevron-left" size={18} color={colors.foreground} />
              </TouchableOpacity>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                const active = p === currentPage;
                return (
                  <TouchableOpacity key={p} onPress={() => setPage(p)}
                    style={{ minWidth: 36, height: 36, borderRadius: 10, paddingHorizontal: 10,
                      alignItems: "center", justifyContent: "center",
                      backgroundColor: active ? colors.primary : colors.secondary }}>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold",
                      color: active ? colors.primaryForeground : colors.foreground }}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity onPress={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
                  backgroundColor: colors.secondary, opacity: currentPage === totalPages ? 0.4 : 1 }}>
                <Feather name="chevron-right" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

function StatChip({ label, value, icon, color, colors }: { label: string; value: string; icon: string; color: string; colors: any }) {
  return (
    <View style={[styles.statChip, { backgroundColor: colors.card }]}>
      <Feather name={icon as any} size={12} color={color} />
      <View>
        <Text style={[styles.statChipLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.statChipValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

function MarketRow({ coin, rank, onPress }: { coin: MarketCoin & { price: number; change24h: number; volume24h: number }; rank: number; onPress: () => void }) {
  const { colors } = useTheme();
  const isPos = coin.change24h >= 0;
  return (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      {/* Name column — fixed width */}
      <View style={[styles.rowLeft, { width: COL.name }]}>
        <Text style={[styles.rowRank, { color: colors.mutedForeground }]}>{rank}</Text>
        <CoinLogo logo={coin.logo} symbol={coin.symbol} color={coin.color} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowSymbol, { color: colors.foreground }]}>{coin.symbol}</Text>
          <Text style={[styles.rowName, { color: colors.mutedForeground }]} numberOfLines={1}>{coin.name}</Text>
        </View>
      </View>
      {/* Price column */}
      <PriceCell symbol={coin.symbol} price={coin.price} change24h={coin.change24h} width={COL.price} />
      {/* 24h % column */}
      <View style={[styles.changeBadge, { width: COL.change, backgroundColor: isPos ? "#00C08718" : "#FF4B4B18" }]}>
        <Text style={[styles.changeText, { color: isPos ? "#00C087" : "#FF4B4B" }]}>
          {isPos ? "+" : ""}{coin.change24h.toFixed(2)}%
        </Text>
      </View>
      {/* Vol column */}
      <Text style={[styles.rowVol, { width: COL.vol, color: colors.mutedForeground }]}>{formatVolume(coin.volume24h)}</Text>
      {/* MCap column */}
      <Text style={[styles.rowVol, { width: COL.mcap, color: colors.mutedForeground }]}>{formatVolume(coin.marketCap)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14 },
  greeting: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 2 },
  portfolioVal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerRight: { flexDirection: "row", gap: 8, alignItems: "center" },
  connBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  connDot: { width: 6, height: 6, borderRadius: 3 },
  connText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", position: "relative" },
  badge: { position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" },
  statsRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  statChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  statChipLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  statChipValue: { fontSize: 13, fontFamily: "Inter_700Bold" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 12, padding: 11, borderRadius: 12 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  liveTagWrap: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  liveTagText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  trendScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 12 },
  trendCard: { width: 116, padding: 12, borderRadius: 14, gap: 5, alignItems: "center" },
  trendSymbol: { fontSize: 13, fontFamily: "Inter_700Bold" },
  trendPrice: { fontSize: 11, fontFamily: "Inter_500Medium" },
  trendChangeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  trendChange: { fontSize: 12, fontFamily: "Inter_700Bold" },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  filterText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  listHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  listHeaderText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowRank: { fontSize: 11, fontFamily: "Inter_400Regular", width: 16, textAlign: "center" },
  rowSymbol: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  rowName: { fontSize: 11, fontFamily: "Inter_400Regular", maxWidth: 62 },
  priceCell: { alignItems: "flex-end", borderRadius: 4, paddingVertical: 2, paddingHorizontal: 4 },
  rowPrice: { fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  changeBadge: { paddingHorizontal: 4, paddingVertical: 3, borderRadius: 5, alignItems: "center", marginHorizontal: 2 },
  changeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  rowVol: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right" },
});
